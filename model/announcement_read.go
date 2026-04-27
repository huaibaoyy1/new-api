package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type AnnouncementRead struct {
	Id             int            `json:"id"`
	AnnouncementId int            `json:"announcement_id" gorm:"index:idx_announcement_user_read,unique"`
	UserId         int            `json:"user_id" gorm:"index:idx_announcement_user_read,unique;index"`
	ReadAt         int64          `json:"read_at" gorm:"bigint;index"`
	CreatedAt      int64          `json:"created_at" gorm:"bigint"`
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

type AnnouncementReadStatus struct {
	UserId      int    `json:"user_id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	CreatedAt   int64  `json:"created_at"`
	LastLoginAt int64  `json:"last_login_at"`
	ReadAt      int64  `json:"read_at"`
	IsRead      bool   `json:"is_read"`
}

type AnnouncementReadStatusSummary struct {
	TotalUsers  int64 `json:"total_users"`
	ReadCount   int64 `json:"read_count"`
	UnreadCount int64 `json:"unread_count"`
}

func MarkAnnouncementRead(announcementId int, userId int) error {
	if announcementId <= 0 {
		return errors.New("无效的公告 ID")
	}
	if userId <= 0 {
		return errors.New("无效的用户 ID")
	}

	now := common.GetTimestamp()

	return DB.Transaction(func(tx *gorm.DB) error {
		var record AnnouncementRead
		err := tx.Where("announcement_id = ? AND user_id = ?", announcementId, userId).First(&record).Error
		if err == nil {
			if record.ReadAt == 0 {
				record.ReadAt = now
			}
			return tx.Model(&record).Updates(map[string]any{
				"read_at": record.ReadAt,
			}).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		record = AnnouncementRead{
			AnnouncementId: announcementId,
			UserId:         userId,
			ReadAt:         now,
			CreatedAt:      now,
		}
		return tx.Create(&record).Error
	})
}

func GetAnnouncementReadMap(userId int, announcementIds []int) (map[int]int64, error) {
	result := make(map[int]int64)
	if userId <= 0 || len(announcementIds) == 0 {
		return result, nil
	}

	var reads []AnnouncementRead
	err := DB.Where("user_id = ? AND announcement_id IN ?", userId, announcementIds).Find(&reads).Error
	if err != nil {
		return nil, err
	}
	for _, read := range reads {
		result[read.AnnouncementId] = read.ReadAt
	}
	return result, nil
}

func GetAnnouncementReadStatus(announcementId int, startIdx int, num int, keyword string, status string) ([]*AnnouncementReadStatus, int64, *AnnouncementReadStatusSummary, error) {
	var users []*User
	var total int64
	summary := &AnnouncementReadStatusSummary{}

	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	baseQuery := tx.Model(&User{}).Unscoped()
	if keyword != "" {
		likeKeyword := "%" + keyword + "%"
		baseQuery = baseQuery.Where("username LIKE ? OR email LIKE ? OR display_name LIKE ?", likeKeyword, likeKeyword, likeKeyword)
	}

	if err := baseQuery.Count(&summary.TotalUsers).Error; err != nil {
		tx.Rollback()
		return nil, 0, nil, err
	}

	readQuery := tx.Model(&User{}).Unscoped().
		Joins("JOIN announcement_reads ar ON ar.user_id = users.id AND ar.announcement_id = ?", announcementId)
	if keyword != "" {
		likeKeyword := "%" + keyword + "%"
		readQuery = readQuery.Where("users.username LIKE ? OR users.email LIKE ? OR users.display_name LIKE ?", likeKeyword, likeKeyword, likeKeyword)
	}
	if err := readQuery.Count(&summary.ReadCount).Error; err != nil {
		tx.Rollback()
		return nil, 0, nil, err
	}
	summary.UnreadCount = summary.TotalUsers - summary.ReadCount

	query := tx.Model(&User{}).Unscoped()
	if keyword != "" {
		likeKeyword := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR email LIKE ? OR display_name LIKE ?", likeKeyword, likeKeyword, likeKeyword)
	}

	switch status {
	case "read":
		query = query.Where("id IN (?)", tx.Model(&AnnouncementRead{}).Select("user_id").Where("announcement_id = ?", announcementId))
	case "unread":
		query = query.Where("id NOT IN (?)", tx.Model(&AnnouncementRead{}).Select("user_id").Where("announcement_id = ?", announcementId))
	}

	if err := query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, nil, err
	}

	if err := query.Order("id desc").Limit(num).Offset(startIdx).Find(&users).Error; err != nil {
		tx.Rollback()
		return nil, 0, nil, err
	}

	userIds := make([]int, 0, len(users))
	for _, user := range users {
		userIds = append(userIds, user.Id)
	}

	readMap := make(map[int]int64)
	if len(userIds) > 0 {
		var reads []AnnouncementRead
		if err := tx.Where("announcement_id = ? AND user_id IN ?", announcementId, userIds).Find(&reads).Error; err != nil {
			tx.Rollback()
			return nil, 0, nil, err
		}
		for _, read := range reads {
			readMap[read.UserId] = read.ReadAt
		}
	}

	items := make([]*AnnouncementReadStatus, 0, len(users))
	for _, user := range users {
		readAt, ok := readMap[user.Id]
		items = append(items, &AnnouncementReadStatus{
			UserId:      user.Id,
			Username:    user.Username,
			Email:       user.Email,
			CreatedAt:   user.CreatedAt,
			LastLoginAt: user.LastLoginAt,
			ReadAt:      readAt,
			IsRead:      ok,
		})
	}

	if err := tx.Commit().Error; err != nil {
		return nil, 0, nil, err
	}

	return items, total, summary, nil
}