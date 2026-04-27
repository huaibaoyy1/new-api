package model

import (
	"strconv"
	"time"

	"gorm.io/gorm"
)

type UserActivityFilter struct {
	Days          int
	ConsumeStatus string
	CheckinStatus string
}

type UserActivitySummary struct {
	TotalUsers       int64 `json:"total_users"`
	ConsumedUsers    int64 `json:"consumed_users"`
	NotConsumedUsers int64 `json:"not_consumed_users"`
	CheckedUsers     int64 `json:"checked_users"`
	NotCheckedUsers  int64 `json:"not_checked_users"`
}

func normalizeUserActivityDays(days int) int {
	if days <= 0 {
		return 1
	}
	if days > 3650 {
		return 3650
	}
	return days
}

func getUserActivityRange(days int) (int64, int64, string, string) {
	days = normalizeUserActivityDays(days)
	now := time.Now()
	location := now.Location()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location).AddDate(0, 0, -days+1)
	end := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, location)
	return start.Unix(), end.Unix(), start.Format("2006-01-02"), end.Format("2006-01-02")
}

func buildUserActivityQuery(tx *gorm.DB, keyword string, group string, filter UserActivityFilter) *gorm.DB {
	startTimestamp, endTimestamp, startDate, endDate := getUserActivityRange(filter.Days)

	consumeSubQuery := tx.Table("quota_data").
		Select("user_id, COALESCE(SUM(token_used), 0) AS total_tokens, COALESCE(SUM(quota), 0) AS total_consume_quota, COALESCE(SUM(count), 0) AS consume_count").
		Where("created_at >= ? AND created_at <= ?", startTimestamp, endTimestamp).
		Group("user_id")

	checkinSubQuery := tx.Table("checkins").
		Select("user_id, COUNT(*) AS checkin_count").
		Where("checkin_date >= ? AND checkin_date <= ?", startDate, endDate).
		Group("user_id")

	query := tx.Unscoped().
		Model(&User{}).
		Select(`users.*,
COALESCE(consume_stats.total_tokens, 0) AS total_tokens,
COALESCE(consume_stats.total_consume_quota, 0) AS total_consume_quota,
COALESCE(consume_stats.consume_count, 0) AS consume_count,
COALESCE(checkin_stats.checkin_count, 0) AS checkin_count`).
		Joins("LEFT JOIN (?) AS consume_stats ON consume_stats.user_id = users.id", consumeSubQuery).
		Joins("LEFT JOIN (?) AS checkin_stats ON checkin_stats.user_id = users.id", checkinSubQuery)

	if keyword != "" {
		likeCondition := "username LIKE ? OR email LIKE ? OR display_name LIKE ?"
		keywordInt, err := strconv.Atoi(keyword)
		if err == nil {
			likeCondition = "id = ? OR " + likeCondition
			if group != "" {
				query = query.Where("("+likeCondition+") AND "+commonGroupCol+" = ?",
					keywordInt, "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", group)
			} else {
				query = query.Where(likeCondition,
					keywordInt, "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
			}
		} else {
			if group != "" {
				query = query.Where("("+likeCondition+") AND "+commonGroupCol+" = ?",
					"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", group)
			} else {
				query = query.Where(likeCondition,
					"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
			}
		}
	} else if group != "" {
		query = query.Where(commonGroupCol+" = ?", group)
	}

	switch filter.ConsumeStatus {
	case "consumed":
		query = query.Where("COALESCE(consume_stats.consume_count, 0) > 0")
	case "not_consumed":
		query = query.Where("COALESCE(consume_stats.consume_count, 0) = 0")
	}

	switch filter.CheckinStatus {
	case "checked":
		query = query.Where("COALESCE(checkin_stats.checkin_count, 0) > 0")
	case "not_checked":
		query = query.Where("COALESCE(checkin_stats.checkin_count, 0) = 0")
	}

	return query
}

func fillUserActivityFields(users []*User) {
	for _, user := range users {
		user.CheckedIn = user.CheckinCount > 0
	}
}

func GetAllUsersActivity(keyword string, group string, filter UserActivityFilter) ([]*User, error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var users []*User
	query := buildUserActivityQuery(tx, keyword, group, filter)
	if err := query.Order("users.id desc").Omit("password").Find(&users).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	fillUserActivityFields(users)

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return users, nil
}

func GetUserActivitySummary(keyword string, group string, filter UserActivityFilter) (*UserActivitySummary, error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	baseFilter := filter
	baseFilter.ConsumeStatus = "all"
	baseFilter.CheckinStatus = "all"

	baseQuery := buildUserActivityQuery(tx, keyword, group, baseFilter)
	summary := &UserActivitySummary{}

	if err := baseQuery.Count(&summary.TotalUsers).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := buildUserActivityQuery(tx, keyword, group, UserActivityFilter{
		Days:          filter.Days,
		ConsumeStatus: "consumed",
		CheckinStatus: "all",
	}).Count(&summary.ConsumedUsers).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	summary.NotConsumedUsers = summary.TotalUsers - summary.ConsumedUsers

	if err := buildUserActivityQuery(tx, keyword, group, UserActivityFilter{
		Days:          filter.Days,
		ConsumeStatus: "all",
		CheckinStatus: "checked",
	}).Count(&summary.CheckedUsers).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	summary.NotCheckedUsers = summary.TotalUsers - summary.CheckedUsers

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return summary, nil
}