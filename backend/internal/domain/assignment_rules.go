package domain

import (
	"fmt"
	"strings"
)

// AssignmentRules encapsulates logic for Task generation and structure
// This replaces duplicated logic in project_repository.go and assignment_service.go
type AssignmentRules struct{}

var Rules = &AssignmentRules{}

// IsNestedCategory determines if a Main/Child category pair follows the Nested (Station/Inverter) structure.
func (r *AssignmentRules) IsNestedCategory(mainName, childName string) bool {
	mainLower := strings.ToLower(mainName)
	childLower := strings.ToLower(childName)

	// 1. DC Measurement Voltage
	if strings.Contains(childLower, "dc") && strings.Contains(childLower, "measurement") && strings.Contains(childLower, "voltage") {
		return true
	}

	// 2. AC Inverter Check
	if strings.Contains(childLower, "ac") && strings.Contains(childLower, "inverter") && strings.Contains(childLower, "check") {
		return true
	}

	// 3. Inverter Children (excluding AC Connect)
	if strings.Contains(mainLower, "inverter") && !strings.Contains(childLower, "ac connect") {
		return true
	}

	// 4. Legacy: Measurement DC wire (excluding conduit)
	if strings.Contains(childLower, "dc") && strings.Contains(childLower, "wire") && !strings.Contains(childLower, "conduit") {
		return true
	}

	return false
}

// ParseSpecs extracts Station and Inverter quantities from DataWork or Child Specs
func (r *AssignmentRules) ParseSpecs(childMap map[string]interface{}, globalSpecs map[string]interface{}) (stationQty, inverterQty int) {
	// 1. Try Child Specs
	if specs, ok := childMap["specs"].(map[string]interface{}); ok {
		if s, ok := specs["station_qty"].(float64); ok {
			stationQty = int(s)
		}
		if i, ok := specs["inverter_qty"].(float64); ok {
			inverterQty = int(i)
		}
		return
	}

	// 2. Try Global Specs
	if globalSpecs != nil {
		if stationQty == 0 {
			if s, ok := globalSpecs["station_qty"].(float64); ok {
				stationQty = int(s)
			}
		}
		if inverterQty == 0 {
			if i, ok := globalSpecs["inverter_qty"].(float64); ok {
				inverterQty = int(i)
			}
		}
	}

    // 3. Fallback: Use 'quantity' field from ChildMap for StationQty if still 0
    if stationQty == 0 {
        if q, ok := childMap["quantity"]; ok {
            if s, ok := q.(string); ok {
                fmt.Sscanf(s, "%d", &stationQty)
            } else if f, ok := q.(float64); ok {
                stationQty = int(f)
            }
        }
        // If still 0, default to 1? Or let caller decide.
        // Usually safer to return what we found.
    }
    
	return
}

// GetTaskNameInfo returns the Station and Inverter names for a given flat index
// index: 0-based index from the total list of tasks
// qty: The "Quantity" field from the Assign (often Total Items)
// stationQty, inverterQty: Parsed specs
func (r *AssignmentRules) GetTaskNameInfo(index int, qty int, stationQty, inverterQty int, isNested bool) (stationName string, inverterName string) {
	if isNested && inverterQty > 0 {
		// Nested Logic
		// Linear Index = (StationIdx-1) * InverterQty + (InverterIdx-1)
		// StationIdx = (Index / InverterQty) + 1
		// InverterIdx = (Index % InverterQty) + 1
		
		// Fallback if stationQty is dynamic based on total
		// Total Items = Station * Inverter
		
		sIdx := (index / inverterQty) + 1
		invIdx := (index % inverterQty) + 1
		
		stationName = fmt.Sprintf("Station %d", sIdx)
		inverterName = fmt.Sprintf("Inverter %d", invIdx)
		return
	}

	// Standard Logic
	// Each item is a "Station" (or just numbered item)
	sIdx := index + 1
	stationName = fmt.Sprintf("Station %d", sIdx)
	return // inverterName is empty
}

// CalculateIndexFromNames tries to reverse-engineer the linear index from Station/Inverter numbers
// Useful for parsing folder names like "Station_1", "Inverter_2"
func (r *AssignmentRules) CalculateIndexFromNames(stationIdx, inverterIdx, inverterQty int) int {
	if inverterQty <= 0 { return -1 }
	return (stationIdx - 1) * inverterQty + (inverterIdx - 1)
}
