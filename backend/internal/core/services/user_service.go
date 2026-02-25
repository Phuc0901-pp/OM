package services

import (
	"errors"
	"fmt"

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
	return s.userRepo.FindAll()
}

func (s *UserService) GetDB() *gorm.DB {
	return s.userRepo.GetDB()
}

func (s *UserService) GetUsersByLeaderID(leaderIDStr string) ([]domain.User, error) {
	leaderID, err := uuid.Parse(leaderIDStr)
	if err != nil {
		return nil, errors.New("invalid leader ID format")
	}
	return s.userRepo.GetUsersByLeaderID(leaderID)
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
		user.Role = domain.UserRole(user.RoleModel.Name)
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
		user.Role = domain.UserRole(user.RoleModel.Name)
	}

	return user, nil
}

func (s *UserService) CreateUser(email, password, fullName, roleIDStr, teamIDStr, phoneNumber, telegramChatID, leaderIDStr string) (*domain.User, error) {
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
		FullName:       fullName,
		RoleID:         &roleID,
		NumberPhone:    phoneNumber,
		TelegramChatID: telegramChatID,
	}

	// Parse team ID if provided
	if teamIDStr != "" {
		teamID, err := uuid.Parse(teamIDStr)
		if err != nil {
			return nil, errors.New("invalid team ID format")
		}
		user.TeamID = &teamID
	}

	// Parse leader ID if provided (e.g. manager auto-assigns self as leader)
	if leaderIDStr != "" {
		fmt.Println("DEBUG: Parsing leaderIDStr:", leaderIDStr)
		leaderID, err := uuid.Parse(leaderIDStr)
		if err != nil {
			fmt.Println("DEBUG: Parse fail:", err)
			return nil, errors.New("invalid leader ID format")
		}
		user.LeaderID = &leaderID
		fmt.Println("DEBUG: Successfully set user.LeaderID to:", user.LeaderID)
	}

	// Save to database
	if err := s.userRepo.Create(user); err != nil {
		fmt.Println("DEBUG: Create user failed:", err)
		return nil, err
	}
	
	fmt.Println("DEBUG: Successfully created user with LeaderID:", user.LeaderID)

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

func (s *UserService) UpdateUser(idStr, email, fullName, numberPhone, telegramChatID string) (*domain.User, error) {
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

	// Update fields
	if email != "" {
		user.Email = email
	}
	if fullName != "" {
		user.FullName = fullName
	}
	// Always update phone and chat ID
	user.NumberPhone = numberPhone
	user.TelegramChatID = telegramChatID

	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *UserService) AssignLeader(userIDStr, leaderIDStr string) error {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}

	var leaderID *uuid.UUID
	if leaderIDStr != "" {
		id, err := uuid.Parse(leaderIDStr)
		if err != nil {
			return errors.New("invalid leader ID format")
		}
		leaderID = &id
	}

	return s.userRepo.UpdateLeader(userID, leaderID)
}
