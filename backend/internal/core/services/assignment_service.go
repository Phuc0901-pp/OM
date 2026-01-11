package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"path"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
)

type AssignmentService struct {
	Repo        domain.ProjectRepository
	MinioClient *storage.MinioClient
}

func NewAssignmentService(repo domain.ProjectRepository, minio *storage.MinioClient) *AssignmentService {
	return &AssignmentService{
		Repo:        repo,
		MinioClient: minio,
	}
}

func (s *AssignmentService) getTimePath(assign *domain.Assign) (string, string) {
	// Determine timestamp for folder structure (Year/Quarter)
	// Priority: DataWork.Timestamp -> CreatedAt -> Now
	ts := assign.CreatedAt
	
	if assign.DataWork != nil {
		if tStr, ok := assign.DataWork["timestamp"].(string); ok && tStr != "" {
			if parsed, err := time.Parse(time.RFC3339, tStr); err == nil {
				ts = parsed
			} else if parsed, err := time.Parse("2006-01-02", tStr); err == nil {
				ts = parsed
			}
		}
	}

	year := ts.Year()
	month := ts.Month()
	
	quarter := 1
	if month >= 4 && month <= 6 {
		quarter = 2
	} else if month >= 7 && month <= 9 {
		quarter = 3
	} else if month >= 10 {
		quarter = 4
	}

	return fmt.Sprintf("%d", year), fmt.Sprintf("Q%d", quarter)
}

func (s *AssignmentService) UpdateProgress(id uuid.UUID, data domain.AssetMetadata) (domain.AssetMetadata, error) {
	assign, err := s.Repo.GetAssignByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get assignment: %w", err)
	}

	// Prepare path components
	year, quarter := s.getTimePath(assign)
	projectName := "UnknownProject"
	if assign.Project != nil {
		projectName = sanitizeName(assign.Project.ProjectName)
	}
	className := "UnknownClass"
	if assign.Classification != nil {
		className = sanitizeName(assign.Classification.Name)
	}
	
	log.Printf("[DEBUG] UpdateProgress ID=%s | ProjID=%s | ProjName=%s | Class=%s | Year=%s Quarter=%s", id, assign.ProjectID, projectName, className, year, quarter)


	// Build Category Map for efficient lookup
	categoryMap := make(map[string]struct {
		MainName  string
		ChildName string
		ChildMap  map[string]interface{}
	})
	if mainCats, ok := assign.DataWork["main_categories"].([]interface{}); ok {
		for _, m := range mainCats {
			if mainMap, ok := m.(map[string]interface{}); ok {
				mName, _ := mainMap["name"].(string)
				if children, ok := mainMap["child_categories"].([]interface{}); ok {
					for _, c := range children {
						if childMap, ok := c.(map[string]interface{}); ok {
							cName, _ := childMap["name"].(string)
							cID, _ := childMap["id"].(string)
							if cID != "" {
								categoryMap[cID] = struct {
									MainName  string
									ChildName string
									ChildMap  map[string]interface{}
								}{MainName: mName, ChildName: cName, ChildMap: childMap}
							}
						}
					}
				}
			}
		}
	}

	// Detect Deleted Images: Compare Old vs New
	oldURLs := s.collectImageURLs(assign.DataResult)
	newURLs := s.collectImageURLs(data)
	
	var deletedURLs []string
	for u := range oldURLs {
		if !newURLs[u] && strings.Contains(u, s.MinioClient.Bucket) {
			deletedURLs = append(deletedURLs, u)
		}
	}
	
	if len(deletedURLs) > 0 {
		go func(urls []string) {
			for _, u := range urls {
				// Parse object key from URL
				// URL format: https://host/bucket/key
				parts := strings.SplitN(u, s.MinioClient.Bucket+"/", 2)
				if len(parts) == 2 {
					key := parts[1]
					log.Printf("Deleting removed image from MinIO: %s", key)
					s.MinioClient.Client.RemoveObject(context.Background(), s.MinioClient.Bucket, key, minio.RemoveObjectOptions{})
				}
			}
		}(deletedURLs)
	}

	// Iterating data to upload images
	updatedData := make(domain.AssetMetadata)
	// Copy existing data first to ensure we don't lose untouched keys? 
	// Actually data passed in is usually the *full* set from frontend or valid patches.
	// But safely, we should merge. For now assuming full payload or handling per key.
	// Frontend sends full 'results' object usually.

    updates := []struct {
         ChildID string
         Index   int
         Status  int
    }{}

	for childID, val := range data {
		resultList, ok := val.([]interface{})
		if !ok {
			// Handle single object
			resultList = []interface{}{val}
		}
		
		var processedList []interface{}
		
		catInfo, hasCat := categoryMap[childID]
		isNested := false
		stationQty := 0
		inverterQty := 0
		
		if hasCat {
			isNested = domain.Rules.IsNestedCategory(catInfo.MainName, catInfo.ChildName)
			// Parse Specs
			var globalSpecs map[string]interface{}
			if gs, ok := assign.DataWork["specs"].(map[string]interface{}); ok {
				globalSpecs = gs
			}
			stationQty, inverterQty = domain.Rules.ParseSpecs(catInfo.ChildMap, globalSpecs)
		}

		for idx, item := range resultList {
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				processedList = append(processedList, item)
				continue
			}

			// Path Construction
			// <Year>/<Quarter>/<Project>/<Class>/<Main>/<Child>/<Item>/<Stage>/File
			mainFolder := "Uncategorized"
			childFolder := "Uncategorized"
			if hasCat {
				mainFolder = sanitizeName(catInfo.MainName)
				childFolder = sanitizeName(catInfo.ChildName)
			}

			// Determine Item Folder Name
			itemFolder := fmt.Sprintf("Item_%d", idx+1)
			if hasCat && isNested {
				sName, invName := domain.Rules.GetTaskNameInfo(idx, len(resultList), stationQty, inverterQty, isNested)
				if invName != "" {
					itemFolder = path.Join(strings.ReplaceAll(sName, " ", "_"), strings.ReplaceAll(invName, " ", "_"))
				} else {
					itemFolder = strings.ReplaceAll(sName, " ", "_")
				}
			}

			// Process Stages
			for _, stage := range []string{"before", "after"} {
				stageData, ok := itemMap[stage].(map[string]interface{})
				if !ok || stageData == nil { continue }
				
				images, ok := stageData["images"].([]interface{})
				if !ok { continue }

				var newImages []string
				
				for i, img := range images {
					imgStr, ok := img.(string)
					if !ok { continue }

					if strings.HasPrefix(imgStr, "data:image") {
						// Upload
						folderPath := path.Join(year, quarter, projectName, className, mainFolder, childFolder, itemFolder, strings.Title(stage))
						fileName := fmt.Sprintf("%d_%d.jpg", time.Now().UnixNano(), i)
						fullPath := path.Join(folderPath, fileName)

						url, err := s.uploadBase64(imgStr, fullPath)
						if err != nil {
							log.Printf("Upload failed: %v", err)
							newImages = append(newImages, imgStr) // Keep base64 if fail?
						} else {
							newImages = append(newImages, url)
						}
					} else {
						newImages = append(newImages, imgStr)
					}
				}
				stageData["images"] = newImages

				// ---------------------------------------------------------
				// Note Upload Logic (Requested: "y chang data ảnh")
				// ---------------------------------------------------------
				if noteVal, ok := stageData["note"].(string); ok && noteVal != "" {
					// We upload the note to MinIO as note.txt in the same folder
					// Path: .../Stage/note.txt
					folderPath := path.Join(year, quarter, projectName, className, mainFolder, childFolder, itemFolder, strings.Title(stage))
					notePath := path.Join(folderPath, "note.txt")

					// Upload text
					_, err := s.MinioClient.Client.PutObject(
						context.Background(),
						s.MinioClient.Bucket,
						notePath,
						strings.NewReader(noteVal),
						int64(len(noteVal)),
						minio.PutObjectOptions{ContentType: "text/plain"},
					)
					if err != nil {
						log.Printf("Failed to upload note to MinIO: %v", err)
					} else {
						log.Printf("Uploaded note to: %s", notePath)
					}
				}
			}
            
            processedList = append(processedList, itemMap)
            
            // Calculate Status for Sync
            hasBefore := false
            hasAfter := false
            if b, ok := itemMap["before"].(map[string]interface{}); ok {
                if imgs, ok := b["images"].([]string); ok && len(imgs) > 0 { hasBefore = true }
             }
             if a, ok := itemMap["after"].(map[string]interface{}); ok {
                if imgs, ok := a["images"].([]string); ok && len(imgs) > 0 { hasAfter = true }
             }
             
             status := 0
             if hasBefore && hasAfter { 
				status = 3 
			 } else if hasAfter { 
				status = 2 
			 } else if hasBefore { 
				status = 1 
			 }
             
             // Check if "Submitted" explicitly in Frontend (check=3)
             // If frontend sent check=3, we WANT to respect it because that triggers "Waiting for Approval"
             if c, ok := itemMap["check"].(float64); ok && int(c) == 3 {
                 status = 3
             }
             
             updates = append(updates, struct{ChildID string; Index int; Status int}{childID, idx, status})
		}
		updatedData[childID] = processedList
	}
    
    // Save to DB
    err = s.Repo.UpdateAssignDataResult(id, updatedData)
    if err != nil {
        return nil, err
    }
    
    // Sync Status to TaskDetails
    go func() {
        for _, up := range updates {
             if cID, err := uuid.Parse(up.ChildID); err == nil {
                 s.Repo.UpdateTaskDetailCheck(id, cID, up.Index, up.Status)
             }
        }
    }()

	// Sync JSON Data to SQL Table for Statistics
    // CRITICAL FIX: Update the assign object with the NEW data before syncing
    assign.DataResult = updatedData

	if err := s.syncTaskDetails(assign); err != nil {
		log.Printf("Failed to sync task details: %v", err)
		// Don't fail the request, just log
	}

	return updatedData, nil
}

func (s *AssignmentService) uploadBase64(base64Str string, objectName string) (string, error) {
	if s.MinioClient == nil || s.MinioClient.Client == nil {
		return "", fmt.Errorf("minio client not init")
	}
	parts := strings.Split(base64Str, ",")
	if len(parts) != 2 { return "", fmt.Errorf("invalid base64") }
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil { return "", fmt.Errorf("decode err: %w", err) }
	
	_, err = s.MinioClient.Client.PutObject(context.Background(), s.MinioClient.Bucket, objectName, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{ContentType: "image/jpeg"})
	if err != nil { return "", fmt.Errorf("put err: %w", err) }
	
	return fmt.Sprintf("https://%s/%s/%s", "minio.raitek.cloud", s.MinioClient.Bucket, objectName), nil
}

func (s *AssignmentService) collectImageURLs(data domain.AssetMetadata) map[string]bool {
	urls := make(map[string]bool)
	for _, v := range data {
		list, ok := v.([]interface{})
		if !ok { continue }
		for _, item := range list {
			m, ok := item.(map[string]interface{})
			if !ok { continue }
			for _, stage := range []string{"before", "after"} {
				if sm, ok := m[stage].(map[string]interface{}); ok {
					if imgs, ok := sm["images"].([]interface{}); ok {
						for _, img := range imgs {
							if s, ok := img.(string); ok && strings.HasPrefix(s, "http") {
								urls[s] = true
							}
						}
					}
				}
			}
		}
	}
	return urls
}

// Helper to sync JSON DataResult -> SQL TaskDetails
func (s *AssignmentService) syncTaskDetails(assign *domain.Assign) error {
	var details []domain.TaskDetail
	
	// Map categories for efficient lookup
	categoryMap := make(map[string]struct {
		MainName  string
		ChildName string
		ChildMap  map[string]interface{}
	})
	
	// We need DataWork to map IDs to Names
	if mainCats, ok := assign.DataWork["main_categories"].([]interface{}); ok {
		for _, m := range mainCats {
			if mainMap, ok := m.(map[string]interface{}); ok {
				mName, _ := mainMap["name"].(string)
				if children, ok := mainMap["child_categories"].([]interface{}); ok {
					for _, c := range children {
						if childMap, ok := c.(map[string]interface{}); ok {
							cName, _ := childMap["name"].(string)
							cID, _ := childMap["id"].(string)
							if cID != "" {
								categoryMap[cID] = struct {
									MainName  string
									ChildName string
									ChildMap  map[string]interface{}
								}{MainName: mName, ChildName: cName, ChildMap: childMap}
							}
						}
					}
				}
			}
		}
	}

    // Spec Helper
    var globalSpecs map[string]interface{}
    if gs, ok := assign.DataWork["specs"].(map[string]interface{}); ok {
        globalSpecs = gs
    }

	// Iterate DataResult
	for childID, val := range assign.DataResult {
		resultList, ok := val.([]interface{})
		if !ok { continue } // Should be list

		catInfo, hasCat := categoryMap[childID]
		childUUID, err := uuid.Parse(childID)
        if err != nil {
            continue
        }
		
		isNested := false
		stationQty := 0
		inverterQty := 0
		
		if hasCat {
			isNested = domain.Rules.IsNestedCategory(catInfo.MainName, catInfo.ChildName)
			stationQty, inverterQty = domain.Rules.ParseSpecs(catInfo.ChildMap, globalSpecs)
		}

		for idx, item := range resultList {
			itemMap, ok := item.(map[string]interface{})
			if !ok { continue }

            // Determine Name
			stationName := ""
            inverterName := ""
			
			if hasCat {
                // Check if frontend provided specific names (e.g. preserved from DB)
                sVal, sOk := itemMap["station_name"].(string)
                iVal, iOk := itemMap["inverter_name"].(string)
                
                if sOk && sVal != "" {
                     stationName = sVal
                     if iOk { inverterName = iVal }
                } else {
                    // Use domain logic (Fallback)
				    sName, iName := domain.Rules.GetTaskNameInfo(idx, len(resultList), stationQty, inverterQty, isNested)
                    stationName = sName
                    inverterName = iName
                }
			} else {
                stationName = fmt.Sprintf("Item %d", idx+1)
            }

            // Determine Status
            status := "pending"
            check := 0
            
            // Logic: If After images exist -> Completed (Wait for Check)
            // If After Note exists but no images -> Issue? 
            // Simplified: If After Images > 0 -> Completed
            
            hasBefore := false
            hasAfter := false
            firstImage := ""
            note := ""
            
            if b, ok := itemMap["before"].(map[string]interface{}); ok {
                 if imgs, ok := b["images"].([]interface{}); ok && len(imgs) > 0 { 
                     hasBefore = true 
                 }
            }
            if a, ok := itemMap["after"].(map[string]interface{}); ok {
                 if imgs, ok := a["images"].([]interface{}); ok && len(imgs) > 0 { 
                     hasAfter = true
                     // Pick first image for thumbnail
                     if s, ok := imgs[0].(string); ok { firstImage = s }
                 }
                 if n, ok := a["note"].(string); ok { note = n }
            }
            
            if hasAfter {
                status = "completed"
                check = 1 
                if hasBefore { check = 2 } // Both
            }
            
            // Timestamps
            updatedAt := time.Now()
            if timeStr, ok := itemMap["lastActionTime"].(string); ok && timeStr != "" {
                // Try parsing ISO string from frontend (e.g., 2026-01-02T15:57:25.123Z)
                // RFC3339Nano covers standard ISO8601 with fractional seconds
                if t, err := time.Parse(time.RFC3339Nano, timeStr); err == nil {
                    updatedAt = t
                } else if t, err := time.Parse(time.RFC3339, timeStr); err == nil { 
                    updatedAt = t
                } else {
                    fmt.Printf("SyncTaskDetails: Failed to parse time '%s' for item. Error: %v\n", timeStr, err)
                }
            } else {
                 fmt.Printf("SyncTaskDetails: No lastActionTime for item %d\n", idx)
            }
            
            if hasAfter {
                status = "completed"
                check = 1 
                if hasBefore { check = 2 } 
            }

            // Respect "check" from JSON (User Submission)
            log.Printf("[DEBUG SYNC] Item %d RAW Check: %v (Type: %T)", idx, itemMap["check"], itemMap["check"])
            if c, ok := itemMap["check"].(float64); ok {
                if int(c) == 3 {
                    check = 3
                    status = "completed"
                }
            }

            
            var submittedAt *time.Time
            // If submitted (check=3) or implicitly completed by logic (hasAfter), we might set SubmittedAt?
            // User specifically asked for "when I choose to submit...".
            // Logic: If check == 3, it is definitely submitted.
            // If hasAfter (check=1/2), it's also "done" but maybe not "Submitted" button pressed?
            // Frontend handleSubmitItem sets check=3.
            
            if check == 3 {
                 submittedAt = &updatedAt
                 log.Printf("[DEBUG SYNC] Item %d: check=3, SETTING submittedAt=%v", idx, updatedAt)
            } else {
                 log.Printf("[DEBUG SYNC] Item %d: check=%d, submittedAt=nil", idx, check)
            }
            // Fallback: If hasAfter but check != 3 (e.g. older version), treat as submitted?
            // Safer to stick to check == 3 for explicit "Submitted" timestamp.
            // But wait, my previous code set submittedAt if hasAfter.
            // Previous code:
            // if hasAfter { ... check = 3 ... submittedAt = &updatedAt }
            // That was forcing check=3. I should be more nuanced.
            
            dt := domain.TaskDetail{
				AssignID:        assign.ID,
				ChildCategoryID: childUUID, // This was the source of nil values
				Status:          status,
				Note:            note,
				ImagePath:       firstImage,
				Check:           check,
				Accept:          0, // Pending approval
                StationName:     &stationName,
                CreatedAt:       updatedAt, // Technically re-inserted, so maybe okay
                UpdatedAt:       updatedAt,
                SubmittedAt:     submittedAt,
			}
            
            if inverterName != "" {
                dt.InverterName = &inverterName
            }
            
            // CRITICAL: Preserve Task ID if provided by Frontend
            if tIDStr, ok := itemMap["task_id"].(string); ok && tIDStr != "" {
                if parsedID, err := uuid.Parse(tIDStr); err == nil {
                    dt.ID = parsedID
                }
            }
            
            details = append(details, dt)
		}
	}
	
	return s.Repo.SyncTaskDetails(assign.ID, details)
}

func (s *AssignmentService) SyncProgress(id uuid.UUID) (interface{}, error) {
	assign, err := s.Repo.GetAssignByID(id)
	if err != nil { return nil, err }
    
    if assign.DataResult == nil { assign.DataResult = make(map[string]interface{}) }

	year, quarter := s.getTimePath(assign)
    // Basic Info
	projectName := "UnknownProject"
	if assign.Project != nil { projectName = sanitizeName(assign.Project.ProjectName) }
	className := "UnknownClass"
	if assign.Classification != nil { className = sanitizeName(assign.Classification.Name) }

    // Re-Scan MinIO to FIND images, but DO NOT overwrite existing meta.
    // We just ensure all images in MinIO are present in DataResult.
    
    if mainCats, ok := assign.DataWork["main_categories"].([]interface{}); ok {
        for _, m := range mainCats {
            mainMap, _ := m.(map[string]interface{})
            mainName, _ := mainMap["name"].(string)
            children, _ := mainMap["child_categories"].([]interface{})
            
            for _, c := range children {
                childMap, _ := c.(map[string]interface{})
                childName, _ := childMap["name"].(string)
                childID, _ := childMap["id"].(string)
                
                // Prefix: Year/Quarter/Project/Class/Main/Child/
                prefix := path.Join(year, quarter, projectName, className, sanitizeName(mainName), sanitizeName(childName)) + "/"
                
                // Fetch existing result list for this child
                var currentList []map[string]interface{}
                if rawList, ok := assign.DataResult[childID].([]interface{}); ok {
                    for _, item := range rawList {
                        if mItem, ok := item.(map[string]interface{}); ok {
                            currentList = append(currentList, mItem)
                        } else {
                            currentList = append(currentList, map[string]interface{}{})
                        }
                    }
                }

                // --- PRE-ALLOCATION FOR NESTED CATEGORIES ---
                // Ensure list size matches Station * Inverter spec
                isNested := domain.Rules.IsNestedCategory(mainName, childName)
                
                var globalSpecs map[string]interface{}
                if gs, ok := assign.DataWork["specs"].(map[string]interface{}); ok { globalSpecs = gs }
                
                statQty, invQty := domain.Rules.ParseSpecs(childMap, globalSpecs)
                
                
                if isNested && invQty > 0 {
                     // DEBUG: Log Quantity Calculation
                     fmt.Printf("[DEBUG SYNC QTY] Child: %s | IsNested: %v | Specs StatQty: %d | Specs InvQty: %d\n", childName, isNested, statQty, invQty)

                     expectedTotal := statQty * invQty
                     if statQty == 0 { 
                         // Fallback: If stationQty not defined but 'quantity' is? 
                         rawQ := childMap["quantity"]
                         fmt.Printf("[DEBUG SYNC QTY] Child: %s | Raw Quantity Field: %v (Type: %T)\n", childName, rawQ, rawQ)

                         if q, ok := childMap["quantity"].(string); ok {
                             fmt.Sscanf(q, "%d", &statQty)
                         } else if q, ok := childMap["quantity"].(float64); ok {
                             statQty = int(q)
                         }
                         if statQty == 0 { statQty = 1 } 
                         expectedTotal = statQty * invQty
                         fmt.Printf("[DEBUG SYNC QTY] Child: %s | Calculated StatQty: %d | Expected Total: %d\n", childName, statQty, expectedTotal)
                     }

                     if len(currentList) < expectedTotal {
                         // Extend list to expected size
                         needed := expectedTotal - len(currentList)
                         for k := 0; k < needed; k++ {
                             currentList = append(currentList, make(map[string]interface{}))
                         }
                     }
                }
                // --------------------------------------------

                // MinIO Scan
                ctx, cancel := context.WithCancel(context.Background())
                defer cancel()
                objectCh := s.MinioClient.Client.ListObjects(ctx, s.MinioClient.Bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true})
                
                // Map to group images: Index -> Stage -> Set of URLs
                foundImages := make(map[int]map[string]map[string]bool) 

                for obj := range objectCh {
                    if obj.Err != nil { continue }
                    
                    // Parse Path: .../Item_X/Stage/File.jpg OR .../Station_S/Inverter_I/Stage/File.jpg
                    rel := strings.TrimPrefix(obj.Key, prefix)
                    parts := strings.Split(rel, "/")
                    
                    if len(parts) < 2 { continue }
                    
                    // Logic to extract Index
                    folder := parts[0]
                    var idx int = -1
                    
                    if n, err := fmt.Sscanf(folder, "Item_%d", &idx); err == nil && n == 1 {
                        idx = idx - 1
                    } else {
                        // Try Nested: Station_X -> Inverter_Y
                        var sIdx int
                        if n, err := fmt.Sscanf(folder, "Station_%d", &sIdx); err == nil && n == 1 {
                             // Check next part if Inverter
                             if len(parts) > 2 {
                                 var iIdx int
                                 if n, err := fmt.Sscanf(parts[1], "Inverter_%d", &iIdx); err == nil && n == 1 {
                                     // Need Inverter Qty to map
                                     // Simplified: We assume Standard specs or try to guess.
                                     // Better to use stored specs.
                                     // For Sync, this is expensive. 
                                     // Let's rely on stored specs in DataWork.
                                     invQty := 0
                                     if sp, ok := assign.DataWork["specs"].(map[string]interface{}); ok {
                                          if v, ok := sp["inverter_qty"].(float64); ok { invQty = int(v) }
                                     }
                                     if invQty > 0 {
                                         idx = (sIdx - 1) * invQty + (iIdx) // Inverter_0? No usually 1-based.
                                         // backend usually 0-indexed logic in previous steps?
                                         // Previous code: Inverter_%d -> idx. 
                                         // Let's assume 0-indexed internal, 1-based labels.
                                         idx = (sIdx - 1) * invQty + (iIdx) // Adjust if Inverter_1 is 0
                                         // InverterName usually "Inverter 1". 
                                         // Let's assume folder is "Inverter_0" based on idx? 
                                         // Wait, upload logic used `invIdx`.
                                         // `invIdx` in loop 0..N.
                                         // `GetTaskNameInfo` returns "Inverter 1". -> "Inverter_1".
                                         // So usually 1-based.
                                         idx = (sIdx - 1) * invQty + (iIdx - 1)
                                     }
                                 }
                             }
                        }
                    }
                    
                    if idx < 0 { continue }
                    
                    // Stage
                    stage := "after"
                    // Check parent of file
                    parent := parts[len(parts)-2]
                    if strings.EqualFold(parent, "Before") { stage = "before" }
                    
                    url := fmt.Sprintf("https://minio.raitek.cloud/%s/%s", s.MinioClient.Bucket, obj.Key)
                    
                    if foundImages[idx] == nil { foundImages[idx] = make(map[string]map[string]bool) }
                    if foundImages[idx][stage] == nil { foundImages[idx][stage] = make(map[string]bool) }
                    foundImages[idx][stage][url] = true
                }
                
                // Sync: Merge Found AND Convert Missing to Clean
                // iterate max(len(currentList), max_idx_found)
                maxIdx := len(currentList) - 1
                for k := range foundImages {
                    if k > maxIdx { maxIdx = k }
                }

                for i := 0; i <= maxIdx; i++ {
                    // Extend if needed
                    if i >= len(currentList) {
                         currentList = append(currentList, make(map[string]interface{}))
                    }
                    
                    item := currentList[i]
                    stagesFound := foundImages[i] // can be nil

                    for _, stageName := range []string{"before", "after"} {
                        stageMap, _ := item[stageName].(map[string]interface{})
                        if stageMap == nil { stageMap = make(map[string]interface{}) }

                        // 1. Get existing DB URLs
                        var dbURLs []string
                        if imgs, ok := stageMap["images"].([]interface{}); ok {
                            for _, img := range imgs {
                                if s, ok := img.(string); ok { dbURLs = append(dbURLs, s) }
                            }
                        }

                        // 2. Get Found MinIO URLs
                        minioURLsMap := make(map[string]bool)
                        if stagesFound != nil && stagesFound[stageName] != nil {
                            minioURLsMap = stagesFound[stageName]
                        }

                        // 3. Filter DB URLs: Keep only if exists in MinIO or is base64 (unsaved)
                        var finalURLs []string
                        
                        // Add existing VALID DB URLs
                        for _, u := range dbURLs {
                            // If base64, keep it (client hasn't synced yet?) -> Actually Sync is backend process.
                            // If user is editing, Sync shouldn't run? 
                            // Assuming Sync is manual trigger.
                            if strings.HasPrefix(u, "data:image") {
                                // keep
                                finalURLs = append(finalURLs, u)
                            } else {
                                // It is a URL. Check if exists in MinIO scan
                                if minioURLsMap[u] {
                                    finalURLs = append(finalURLs, u)
                                    delete(minioURLsMap, u) // Mark as processed
                                }
                                // Else: Drop it (Cleanup)
                            }
                        }

                        // 4. Add NEW MinIO URLs (that were not in DB)
                        for u := range minioURLsMap {
                            finalURLs = append(finalURLs, u)
                        }

                        if len(finalURLs) > 0 {
                            stageMap["images"] = finalURLs
                            // timestamp logic
                            if stageMap["timestamp"] == nil {
                                stageMap["timestamp"] = time.Now().UTC().Format(time.RFC3339)
                            }
                            item[stageName] = stageMap
                        } else {
                            // If empty, clear stage? Or just empty images
                            stageMap["images"] = []string{}
                            item[stageName] = stageMap
                        }
                    }
                    currentList[i] = item
                }
                
                assign.DataResult[childID] = currentList
            }
        }
    }

    // --- SYNC TASK DETAILS (NEW) ---
    var taskDetails []domain.TaskDetail
    
    // We need to look up specs from DataWork to do this correctly
    // Helper to find Child Data in DataWork
    findChildWork := func(cID string) (map[string]interface{}, string, string) {
        if mainCats, ok := assign.DataWork["main_categories"].([]interface{}); ok {
            for _, m := range mainCats {
                mMap, _ := m.(map[string]interface{})
                mainName, _ := mMap["name"].(string)
                children, _ := mMap["child_categories"].([]interface{})
                for _, c := range children {
                    cMap, _ := c.(map[string]interface{})
                    if idStr, ok := cMap["id"].(string); ok && idStr == cID {
                         cName, _ := cMap["name"].(string)
                         return cMap, mainName, cName
                    }
                }
            }
        }
        return nil, "", ""
    }

    // Iterate the "DataResult"
    for childID, listData := range assign.DataResult {
        if list, ok := listData.([]interface{}); ok {
            // 1. Get Context
            cMap, mainName, childName := findChildWork(childID)
            if cMap == nil { continue }
            
            // 2. Parse Specs & Rules
            var globalSpecs map[string]interface{}
            if gs, ok := assign.DataWork["specs"].(map[string]interface{}); ok {
                globalSpecs = gs
            }
            
            stationQty, inverterQty := domain.Rules.ParseSpecs(cMap, globalSpecs)
            isNested := domain.Rules.IsNestedCategory(mainName, childName)
            
            // Get Total Quantity defined in Work (to pass to naming rule if needed, though usually just list length)
            // But list length in DataResult IS the quantity usually.
            qty := len(list) 

            for i, item := range list {
                if mapItem, ok := item.(map[string]interface{}); ok {
                    // Check if "after" has images
                    var hasAfter bool
                    if after, ok := mapItem["after"].(map[string]interface{}); ok {
                        if imgs, ok := after["images"].([]interface{}); ok && len(imgs) > 0 {
                            hasAfter = true
                        }
                    }

                    // Determine Status
                    status := "pending"
                    check := 0
                    if hasAfter {
                        status = "waiting_approval"
                        check = 1
                    }
                    
                    // 3. Generate Correct Names using Domain Rules
                    sName, iName := domain.Rules.GetTaskNameInfo(i, qty, stationQty, inverterQty, isNested)
                    
                    var sNamePtr *string
                    var iNamePtr *string
                    
                    if sName != "" { sNamePtr = &sName }
                    if iName != "" { iNamePtr = &iName }
                    
                    // Construct TaskDetail
                    cUUID, _ := uuid.Parse(childID)
                    
                    td := domain.TaskDetail{
                        AssignID: assign.ID,
                        ChildCategoryID: cUUID,
                        StationName: sNamePtr,
                        InverterName: iNamePtr,
                        Status: status,
                        Check: check,
                    }
                    taskDetails = append(taskDetails, td)
                }
            }
        }
    }
    
    // Call Sync Repo
    if len(taskDetails) > 0 {
         if err := s.Repo.SyncTaskDetails(id, taskDetails); err != nil {
             return assign.DataResult, fmt.Errorf("sync task details failed: %w", err)
         }
    }


	err = s.Repo.UpdateAssignDataResult(id, assign.DataResult)
	return assign.DataResult, err
}

func sanitizeName(name string) string {
    // Basic sanitization
    name = strings.ReplaceAll(name, "/", "-")
    name = strings.ReplaceAll(name, "\\", "-")
    return name
}



func getKeys(m map[string]interface{}) []string {
    keys := make([]string, 0, len(m))
    for k := range m {
        keys = append(keys, k)
    }
    return keys
}

func (s *AssignmentService) SyncAllProgress() (interface{}, error) {
    // 1. Fetch all assignments
    // Note: This operation can be resource intensive.
    assigns, err := s.Repo.GetAllAssigns() 
    if err != nil {
        return nil, fmt.Errorf("failed to fetch all assignments: %w", err)
    }

    // 2. Iterate and Sync
    var errList []string
    successCount := 0
    
    // Potential optimization: Limit concurrency if needed.
    for _, assign := range assigns {
        if _, err := s.SyncProgress(assign.ID); err != nil {
            // log.Printf("Failed to sync assignment %s: %v", assign.ID, err)
            errList = append(errList, fmt.Sprintf("Assign %s: %v", assign.ID, err))
        } else {
            successCount++
        }
    }

    if len(errList) > 0 {
        // Return partial success message or error if critical
        // For now, we return a summary
        return map[string]interface{}{
            "success_count": successCount,
            "error_count": len(errList),
            "errors": errList,
            "message": "Completed with some errors",
        }, nil
    }
    
    return map[string]interface{}{
        "success_count": successCount,
        "message": "Sync completed successfully",
    }, nil
}
