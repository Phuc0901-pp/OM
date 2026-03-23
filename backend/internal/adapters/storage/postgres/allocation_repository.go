package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// ---- Assign Repository ----

type assignRepository struct{ db *gorm.DB }

func NewAssignRepository(db *gorm.DB) domain.AssignRepository {
	return &assignRepository{db: db}
}

func (r *assignRepository) Create(assign *domain.Assign) error {
	return r.db.Create(assign).Error
}

func (r *assignRepository) FindAll() ([]domain.Assign, error) {
	var assigns []domain.Assign
	err := r.db.Preload("Project").Preload("ModelProject").Preload("Template").
		Preload("DetailAssigns").
		Preload("DetailAssigns.Config").
		Preload("DetailAssigns.Config.Asset").
		Preload("DetailAssigns.Config.SubWork").
		Preload("DetailAssigns.Config.SubWork.Work").
		Preload("DetailAssigns.Process").
		Where("deleted_at IS NULL").Order("created_at DESC").Find(&assigns).Error
	return assigns, err
}

// FindByUserID filters assignments where the user's UUID is in the id_user JSONB array
func (r *assignRepository) FindByUserID(userID string) ([]domain.Assign, error) {
	var assigns []domain.Assign
	err := r.db.Preload("Project").Preload("ModelProject").Preload("Template").
		Preload("DetailAssigns").
		Preload("DetailAssigns.Config").
		Preload("DetailAssigns.Config.Asset").
		Preload("DetailAssigns.Config.SubWork").
		Preload("DetailAssigns.Config.SubWork.Work").
		Preload("DetailAssigns.Process").
		Where("id_user::jsonb @> ? AND deleted_at IS NULL", `"`+userID+`"`).
		Order("end_time ASC NULLS LAST").
		Find(&assigns).Error
	return assigns, err
}


func (r *assignRepository) FindByID(id uuid.UUID) (*domain.Assign, error) {
	var assign domain.Assign
	err := r.db.Preload("Project").Preload("ModelProject").Preload("Template").
		Preload("DetailAssigns").
		Preload("DetailAssigns.Config").
		Preload("DetailAssigns.Config.Asset").
		Preload("DetailAssigns.Config.SubWork").
		Preload("DetailAssigns.Config.SubWork.Work").
		Preload("DetailAssigns.Process").
		Where("id = ? AND deleted_at IS NULL", id).First(&assign).Error
	return &assign, err
}

func (r *assignRepository) Update(assign *domain.Assign) error {
	return r.db.Save(assign).Error
}

func (r *assignRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.Assign{}).Error
}

func (r *assignRepository) FindAllDeleted() ([]domain.Assign, error) {
	var assigns []domain.Assign
	err := r.db.Unscoped().Preload("Project").Preload("ModelProject").Preload("Template").
		Where("deleted_at IS NOT NULL").Order("deleted_at DESC").Find(&assigns).Error
	return assigns, err
}

func (r *assignRepository) Restore(id uuid.UUID) error {
	return r.db.Unscoped().Model(&domain.Assign{}).
		Where("id = ?", id).Update("deleted_at", nil).Error
}

func (r *assignRepository) PermanentDelete(id uuid.UUID) error {
	return r.db.Unscoped().Where("id = ?", id).Delete(&domain.Assign{}).Error
}

// ---- DetailAssign Repository ----

type detailAssignRepository struct{ db *gorm.DB }

func NewDetailAssignRepository(db *gorm.DB) domain.DetailAssignRepository {
	return &detailAssignRepository{db: db}
}

func (r *detailAssignRepository) Create(detail *domain.DetailAssign) error {
	return r.db.Create(detail).Error
}

func (r *detailAssignRepository) FindByAssignID(assignID uuid.UUID) ([]domain.DetailAssign, error) {
	var details []domain.DetailAssign
	err := r.db.Preload("Config").Preload("Config.Asset").Preload("Config.SubWork").Preload("Process").
		Where("id_assign = ? AND deleted_at IS NULL", assignID).
		Order("created_at ASC").Find(&details).Error
	return details, err
}

func (r *detailAssignRepository) FindByID(id uuid.UUID) (*domain.DetailAssign, error) {
	var detail domain.DetailAssign
	err := r.db.Preload("Config").Preload("Config.Asset").Preload("Config.SubWork").Preload("Process").Preload("Assign").
		Where("id = ? AND deleted_at IS NULL", id).First(&detail).Error
	return &detail, err
}

func (r *detailAssignRepository) Update(detail *domain.DetailAssign) error {
	return r.db.Save(detail).Error
}

func (r *detailAssignRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.DetailAssign{}).Error
}

func (r *detailAssignRepository) GetNamesForMinioPath(detailAssignID uuid.UUID) (*domain.MinioPathContext, error) {
	var ctx domain.MinioPathContext
	
	query := `
		SELECT 
			COALESCE(p.name, 'unknown') AS project_name,
			COALESCE(mp.name, 'unknown') AS model_project_name,
			COALESCE(tpl.name, 'unknown') AS template_name,
			COALESCE(w.name, 'unknown') AS work_name,
			COALESCE(sw.name, 'unknown') AS sub_work_name,
			COALESCE(a.name, 'unknown') AS asset_name,
			COALESCE(pr.name, 'unknown') AS process_name
		FROM detail_assigns da
		LEFT JOIN assigns asgn ON da.id_assign = asgn.id
		LEFT JOIN projects p ON asgn.id_project = p.id
		LEFT JOIN model_projects mp ON asgn.id_model_project = mp.id
		LEFT JOIN templates tpl ON asgn.id_template = tpl.id
		LEFT JOIN configs c ON da.id_config = c.id
		LEFT JOIN assets a ON c.id_asset = a.id
		LEFT JOIN sub_works sw ON c.id_sub_work = sw.id
		LEFT JOIN works w ON sw.id_work = w.id
		LEFT JOIN process pr ON da.id_process = pr.id
		WHERE da.id = ?
	`
	
	err := r.db.Raw(query, detailAssignID).Scan(&ctx).Error
	if err != nil {
		return nil, err
	}
	
	return &ctx, nil
}
