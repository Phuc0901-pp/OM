package services

import (
	"errors"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService struct {
	userRepo domain.UserRepository
}

func NewUserService(userRepo domain.UserRepository) *UserService {
	return &UserService{
		userRepo: userRepo,
	}
}

func (s *UserService) GetAllUsers() ([]domain.User, error) {
	users, err := s.userRepo.FindAll()
	if err != nil {
		return nil, err
	}

	db := s.userRepo.GetDB()
	if db == nil {
		return users, nil
	}

	// Aggregate query: lấy thống kê assign per user trong 1 lần query duy nhất
	// Database tự JOIN và COUNT, không load object nặng vào RAM
	type assignRow struct {
		UserID         string `gorm:"column:user_id"`
		AssignID       string `gorm:"column:assign_id"`
		ProjectName    string `gorm:"column:project_name"`
		Location       string `gorm:"column:location"`
		SubmittedCount int    `gorm:"column:submitted_count"`
		ApprovedCount  int    `gorm:"column:approved_count"`
	}

	var rows []assignRow
	rawSQL := `
		SELECT
			u.id::text                                              AS user_id,
			a.id::text                                              AS assign_id,
			COALESCE(p.name, '')                                    AS project_name,
			COALESCE(p.location, '')                                AS location,
			COUNT(CASE WHEN d.status_submit  = 1 THEN 1 END)::int  AS submitted_count,
			COUNT(CASE WHEN d.status_approve = 1 THEN 1 END)::int  AS approved_count
		FROM users u
		JOIN assigns a
			ON a.id_user @> jsonb_build_array(u.id::text)
			AND a.deleted_at IS NULL
		LEFT JOIN projects p
			ON a.id_project = p.id AND p.deleted_at IS NULL
		LEFT JOIN detail_assigns d
			ON d.id_assign = a.id AND d.deleted_at IS NULL
		WHERE u.deleted_at IS NULL
		GROUP BY u.id, a.id, p.name, p.location
	`
	if err := db.Raw(rawSQL).Scan(&rows).Error; err != nil {
		// Nếu query lỗi, trả users mà không có project (không crash)
		for i := range users {
			users[i].AssignedProjects = []domain.AssignedProjectDTO{}
		}
		return users, nil
	}

	// Build lookup map: userID → []AssignedProjectDTO
	projectMap := make(map[string][]domain.AssignedProjectDTO, len(users))
	for _, r := range rows {
		dto := domain.AssignedProjectDTO{
			SubmittedCount: r.SubmittedCount,
			ApprovedCount:  r.ApprovedCount,
		}
		if r.ProjectName != "" {
			dto.Project = &domain.ProjectSimpleDTO{
				ProjectName: r.ProjectName,
				Location:    r.Location,
			}
		}
		// Parse assign UUID
		if aid, err := uuid.Parse(r.AssignID); err == nil {
			dto.ID = aid
		}
		projectMap[r.UserID] = append(projectMap[r.UserID], dto)
	}

	// Gán kết quả lại cho từng user
	for i := range users {
		uid := users[i].ID.String()
		if projs, ok := projectMap[uid]; ok {
			users[i].AssignedProjects = projs
		} else {
			users[i].AssignedProjects = []domain.AssignedProjectDTO{}
		}
	}

	return users, nil
}

func (s *UserService) GetDB() *gorm.DB {
	return s.userRepo.GetDB()
}

func (s *UserService) GetUserByID(idStr string) (*domain.User, error) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, errors.New("invalid user ID format")
	}

	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Map RoleModel to user.Role for consistent JSON response if manual mapping logic exists in FindAll, 
	// but currently FindAll does explicit mapping. 
	// Ideally this should be in Repository or Domain method, but doing it here to be safe as per FindAll pattern.
	if user.RoleModel != nil {
		user.RoleName = domain.UserRole(user.RoleModel.Name)
	}

	return user, nil
}

func (s *UserService) GetUserByEmail(email string) (*domain.User, error) {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	if user.RoleModel != nil {
		user.RoleName = domain.UserRole(user.RoleModel.Name)
	}

	return user, nil
}

func (s *UserService) CreateUser(email, password, fullName, roleIDStr, teamIDStr, phoneNumber, creatorIDStr string) (*domain.User, error) {
	// Check if user already exists
	existingUser, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	// Parse role ID
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		return nil, errors.New("invalid role ID format")
	}

	// Create user
	user := &domain.User{
		Email:          email,
		PasswordHash:   string(hashedPassword),
		Name: fullName,
		RoleID:      &roleID,
		NumberPhone: phoneNumber,
	}

	// Parse team ID if provided
	if teamIDStr != "" {
		teamID, err := uuid.Parse(teamIDStr)
		if err != nil {
			return nil, errors.New("invalid team ID format")
		}
		user.TeamID = &teamID
	}

	// Set creator ID if provided
	if creatorIDStr != "" {
		if cid, err := uuid.Parse(creatorIDStr); err == nil {
			// Dùng Unscoped để tìm kể cả user đã bị soft-delete (JWT còn hợp lệ)
			creator, _ := s.userRepo.FindByIDUnscoped(cid)
			if creator != nil {
				user.PersonCreatedID = &cid
			}
		}
	}

	// Save to database
	if err := s.userRepo.Create(user); err != nil {

		return nil, err
	}
	


	return user, nil
}

func (s *UserService) DeleteUser(idStr string) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}
	return s.userRepo.Delete(id)
}

func (s *UserService) UpdateUserRole(userIDStr, roleIDStr string) error {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}

	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		return errors.New("invalid role ID format")
	}

	return s.userRepo.UpdateRole(userID, roleID)
}

func (s *UserService) UpdateUser(idStr, email, fullName, numberPhone, roleIDStr, teamIDStr, password string) (*domain.User, error) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, errors.New("invalid user ID format")
	}

	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Update basic fields
	if email != "" {
		user.Email = email
	}
	if fullName != "" {
		user.Name = fullName
	}
	// Phone can be empty
	user.NumberPhone = numberPhone

	// Update Role
	if roleIDStr != "" {
		roleID, err := uuid.Parse(roleIDStr)
		if err == nil {
			user.RoleID = &roleID
		}
	}

	// Update Team (allow clearing if empty)
	if teamIDStr != "" {
		teamID, err := uuid.Parse(teamIDStr)
		if err == nil {
			user.TeamID = &teamID
		}
	} else {
		user.TeamID = nil
	}

	// Update Password if provided
	if password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err == nil {
			user.PasswordHash = string(hashedPassword)
		}
	}

	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	return user, nil
}

// ChangePassword verifies old password and sets a new hashed password.
func (s *UserService) ChangePassword(idStr, oldPassword, newPassword string) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}

	user, err := s.userRepo.FindByID(id)
	if err != nil || user == nil {
		return errors.New("user not found")
	}

	// Verify old password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
		return errors.New("mật khẩu cũ không đúng")
	}

	// Hash new password
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("failed to hash password")
	}

	user.PasswordHash = string(hashed)
	return s.userRepo.Update(user)
}

// ---- Trash (Soft delete) Service Methods ----

func (s *UserService) GetDeletedUsers() ([]domain.User, error) {
	return s.userRepo.FindAllDeleted()
}

func (s *UserService) RestoreUser(idStr string) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}
	return s.userRepo.Restore(id)
}

func (s *UserService) PermanentDeleteUser(idStr string) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}
	return s.userRepo.PermanentDelete(id)
}

func (s *UserService) BulkRestoreUsers(idStrs []string) error {
	var ids []uuid.UUID
	for _, s := range idStrs {
		id, err := uuid.Parse(s)
		if err != nil {
			return errors.New("invalid user ID: " + s)
		}
		ids = append(ids, id)
	}
	return s.userRepo.BulkRestore(ids)
}

func (s *UserService) BulkPermanentDeleteUsers(idStrs []string) error {
	var ids []uuid.UUID
	for _, str := range idStrs {
		id, err := uuid.Parse(str)
		if err != nil {
			return errors.New("invalid user ID: " + str)
		}
		ids = append(ids, id)
	}
	return s.userRepo.BulkPermanentDelete(ids)
}
