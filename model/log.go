package model

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

type Log struct {
	Id               int    `json:"id" gorm:"index:idx_created_at_id,priority:1;index:idx_user_id_id,priority:2"`
	UserId           int    `json:"user_id" gorm:"index;index:idx_user_id_id,priority:1"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:2;index:idx_created_at_type"`
	Type             int    `json:"type" gorm:"index:idx_created_at_type"`
	Content          string `json:"content"`
	Username         string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName        string `json:"token_name" gorm:"index;default:''"`
	ModelName        string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota            int    `json:"quota" gorm:"default:0"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int    `json:"completion_tokens" gorm:"default:0"`
	UseTime          int    `json:"use_time" gorm:"default:0"`
	IsStream         bool   `json:"is_stream"`
	ChannelId        int    `json:"channel" gorm:"index"`
	ChannelName      string `json:"channel_name" gorm:"->"`
	TokenId          int    `json:"token_id" gorm:"default:0;index"`
	Group            string `json:"group" gorm:"index"`
	Ip               string `json:"ip" gorm:"index;default:''"`
	RequestId        string `json:"request_id,omitempty" gorm:"type:varchar(64);index:idx_logs_request_id;default:''"`
	Other            string `json:"other"`
}

type UserRequestRiskSummary struct {
	UserId       int     `json:"user_id"`
	TotalRequests int    `json:"total_requests"`
	SuccessCount int     `json:"success_count"`
	ErrorCount   int     `json:"error_count"`
	Status2xx    int     `json:"status_2xx"`
	Status4xx    int     `json:"status_4xx"`
	Status5xx    int     `json:"status_5xx"`
	Status401    int     `json:"status_401"`
	Status403    int     `json:"status_403"`
	Status422    int     `json:"status_422"`
	Status429    int     `json:"status_429"`
	ErrorRate    float64 `json:"error_rate"`
	RiskLevel    string  `json:"risk_level"`
}

type UserRiskLogItem struct {
	Id                      int    `json:"id"`
	CreatedAt               int64  `json:"created_at"`
	StatusCode              int    `json:"status_code"`
	ErrorCode               string `json:"error_code"`
	Content                 string `json:"content"`
	ModelName               string `json:"model_name"`
	TokenName               string `json:"token_name"`
	Quota                   int    `json:"quota"`
	UseTime                 int    `json:"use_time"`
	IsStream                bool   `json:"is_stream"`
	ChannelId               int    `json:"channel_id"`
	ChannelName             string `json:"channel_name"`
	Ip                      string `json:"ip"`
	RequestId               string `json:"request_id"`
	Group                   string `json:"group"`
	RequestPreview          string `json:"request_preview"`
	RequestPreviewTruncated bool   `json:"request_preview_truncated"`
	RequestBodySize         int64  `json:"request_body_size"`
	RequestContentType      string `json:"request_content_type"`
}

// don't use iota, avoid change log type value
const (
	LogTypeUnknown = 0
	LogTypeTopup   = 1
	LogTypeConsume = 2
	LogTypeManage  = 3
	LogTypeSystem  = 4
	LogTypeError   = 5
	LogTypeRefund  = 6
)

func formatUserLogs(logs []*Log, startIdx int) {
	for i := range logs {
		logs[i].ChannelName = ""
		var otherMap map[string]interface{}
		otherMap, _ = common.StrToMap(logs[i].Other)
		if otherMap != nil {
			// Remove admin-only debug fields.
			delete(otherMap, "admin_info")
			// delete(otherMap, "reject_reason")
			delete(otherMap, "stream_status")
		}
		logs[i].Other = common.MapToJsonStr(otherMap)
		logs[i].Id = startIdx + i + 1
	}
}

func GetLogByTokenId(tokenId int) (logs []*Log, err error) {
	err = LOG_DB.Model(&Log{}).Where("token_id = ?", tokenId).Order("id desc").Limit(common.MaxRecentItems).Find(&logs).Error
	formatUserLogs(logs, 0)
	return logs, err
}

func RecordLog(userId int, logType int, content string) {
	if logType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(userId, false)
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      logType,
		Content:   content,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record log: " + err.Error())
	}
}

// RecordLogWithAdminInfo 记录操作日志，并将管理员相关信息存入 Other.admin_info，
func RecordLogWithAdminInfo(userId int, logType int, content string, adminInfo map[string]interface{}) {
	if logType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(userId, false)
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      logType,
		Content:   content,
	}
	if len(adminInfo) > 0 {
		other := map[string]interface{}{
			"admin_info": adminInfo,
		}
		log.Other = common.MapToJsonStr(other)
	}
	if err := LOG_DB.Create(log).Error; err != nil {
		common.SysLog("failed to record log: " + err.Error())
	}
}

func RecordTopupLog(userId int, content string, callerIp string, paymentMethod string, callbackPaymentMethod string) {
	username, _ := GetUsernameById(userId, false)
	adminInfo := map[string]interface{}{
		"server_ip":               common.GetIp(),
		"node_name":               common.NodeName,
		"caller_ip":               callerIp,
		"payment_method":          paymentMethod,
		"callback_payment_method": callbackPaymentMethod,
		"version":                 common.Version,
	}
	other := map[string]interface{}{
		"admin_info": adminInfo,
	}
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      LogTypeTopup,
		Content:   content,
		Ip:        callerIp,
		Other:     common.MapToJsonStr(other),
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record topup log: " + err.Error())
	}
}

func RecordErrorLog(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s", userId, channelId, modelName, tokenName, content))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	otherStr := common.MapToJsonStr(other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeError,
		Content:          content,
		PromptTokens:     0,
		CompletionTokens: 0,
		TokenName:        tokenName,
		ModelName:        modelName,
		Quota:            0,
		ChannelId:        channelId,
		TokenId:          tokenId,
		UseTime:          useTimeSeconds,
		IsStream:         isStream,
		Group:            group,
		Ip: func() string {
			if needRecordIp {
				return c.ClientIP()
			}
			return ""
		}(),
		RequestId: requestId,
		Other:     otherStr,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
}

type RecordConsumeLogParams struct {
	ChannelId        int                    `json:"channel_id"`
	PromptTokens     int                    `json:"prompt_tokens"`
	CompletionTokens int                    `json:"completion_tokens"`
	ModelName        string                 `json:"model_name"`
	TokenName        string                 `json:"token_name"`
	Quota            int                    `json:"quota"`
	Content          string                 `json:"content"`
	TokenId          int                    `json:"token_id"`
	UseTimeSeconds   int                    `json:"use_time_seconds"`
	IsStream         bool                   `json:"is_stream"`
	Group            string                 `json:"group"`
	Other            map[string]interface{} `json:"other"`
}

func RecordConsumeLog(c *gin.Context, userId int, params RecordConsumeLogParams) {
	if !common.LogConsumeEnabled {
		return
	}
	logger.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, params=%s", userId, common.GetJsonString(params)))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	otherStr := common.MapToJsonStr(params.Other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeConsume,
		Content:          params.Content,
		PromptTokens:     params.PromptTokens,
		CompletionTokens: params.CompletionTokens,
		TokenName:        params.TokenName,
		ModelName:        params.ModelName,
		Quota:            params.Quota,
		ChannelId:        params.ChannelId,
		TokenId:          params.TokenId,
		UseTime:          params.UseTimeSeconds,
		IsStream:         params.IsStream,
		Group:            params.Group,
		Ip: func() string {
			if needRecordIp {
				return c.ClientIP()
			}
			return ""
		}(),
		RequestId: requestId,
		Other:     otherStr,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
	if common.DataExportEnabled {
		gopool.Go(func() {
			LogQuotaData(userId, username, params.ModelName, params.Quota, common.GetTimestamp(), params.PromptTokens+params.CompletionTokens)
		})
	}
}

type RecordTaskBillingLogParams struct {
	UserId    int
	LogType   int
	Content   string
	ChannelId int
	ModelName string
	Quota     int
	TokenId   int
	Group     string
	Other     map[string]interface{}
}

func RecordTaskBillingLog(params RecordTaskBillingLogParams) {
	if params.LogType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(params.UserId, false)
	tokenName := ""
	if params.TokenId > 0 {
		if token, err := GetTokenById(params.TokenId); err == nil {
			tokenName = token.Name
		}
	}
	log := &Log{
		UserId:    params.UserId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      params.LogType,
		Content:   params.Content,
		TokenName: tokenName,
		ModelName: params.ModelName,
		Quota:     params.Quota,
		ChannelId: params.ChannelId,
		TokenId:   params.TokenId,
		Group:     params.Group,
		Other:     common.MapToJsonStr(params.Other),
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record task billing log: " + err.Error())
	}
}

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string, requestId string) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB
	} else {
		tx = LOG_DB.Where("logs.type = ?", logType)
	}

	if modelName != "" {
		tx = tx.Where("logs.model_name like ?", modelName)
	}
	if username != "" {
		tx = tx.Where("logs.username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if channel != 0 {
		tx = tx.Where("logs.channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
	}
	err = tx.Model(&Log{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	channelIds := types.NewSet[int]()
	for _, log := range logs {
		if log.ChannelId != 0 {
			channelIds.Add(log.ChannelId)
		}
	}

	if channelIds.Len() > 0 {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if common.MemoryCacheEnabled {
			// Cache get channel
			for _, channelId := range channelIds.Items() {
				if cacheChannel, err := CacheGetChannel(channelId); err == nil {
					channels = append(channels, struct {
						Id   int    `gorm:"column:id"`
						Name string `gorm:"column:name"`
					}{
						Id:   channelId,
						Name: cacheChannel.Name,
					})
				}
			}
		} else {
			// Bulk query channels from DB
			if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
				return logs, total, err
			}
		}
		channelMap := make(map[int]string, len(channels))
		for _, channel := range channels {
			channelMap[channel.Id] = channel.Name
		}
		for i := range logs {
			logs[i].ChannelName = channelMap[logs[i].ChannelId]
		}
	}

	return logs, total, err
}

const logSearchCountLimit = 10000

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName string, tokenName string, startIdx int, num int, group string, requestId string) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB.Where("logs.user_id = ?", userId)
	} else {
		tx = LOG_DB.Where("logs.user_id = ? and logs.type = ?", userId, logType)
	}

	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return nil, 0, err
		}
		tx = tx.Where("logs.model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
	}
	err = tx.Model(&Log{}).Limit(logSearchCountLimit).Count(&total).Error
	if err != nil {
		common.SysError("failed to count user logs: " + err.Error())
		return nil, 0, errors.New("查询日志失败")
	}
	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		common.SysError("failed to search user logs: " + err.Error())
		return nil, 0, errors.New("查询日志失败")
	}

	formatUserLogs(logs, startIdx)
	return logs, total, err
}

type Stat struct {
	Quota int `json:"quota"`
	Rpm   int `json:"rpm"`
	Tpm   int `json:"tpm"`
}

func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int, group string) (stat Stat, err error) {
	tx := LOG_DB.Table("logs").Select("sum(quota) quota")

	// 为rpm和tpm创建单独的查询
	rpmTpmQuery := LOG_DB.Table("logs").Select("count(*) rpm, sum(prompt_tokens) + sum(completion_tokens) tpm")

	if username != "" {
		tx = tx.Where("username = ?", username)
		rpmTpmQuery = rpmTpmQuery.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
		rpmTpmQuery = rpmTpmQuery.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return stat, err
		}
		tx = tx.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
		rpmTpmQuery = rpmTpmQuery.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
		rpmTpmQuery = rpmTpmQuery.Where("channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where(logGroupCol+" = ?", group)
		rpmTpmQuery = rpmTpmQuery.Where(logGroupCol+" = ?", group)
	}

	tx = tx.Where("type = ?", LogTypeConsume)
	rpmTpmQuery = rpmTpmQuery.Where("type = ?", LogTypeConsume)

	// 只统计最近60秒的rpm和tpm
	rpmTpmQuery = rpmTpmQuery.Where("created_at >= ?", time.Now().Add(-60*time.Second).Unix())

	// 执行查询
	if err := tx.Scan(&stat).Error; err != nil {
		common.SysError("failed to query log stat: " + err.Error())
		return stat, errors.New("查询统计数据失败")
	}
	if err := rpmTpmQuery.Scan(&stat).Error; err != nil {
		common.SysError("failed to query rpm/tpm stat: " + err.Error())
		return stat, errors.New("查询统计数据失败")
	}

	return stat, nil
}

func SumUsedToken(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string) (token int) {
	tx := LOG_DB.Table("logs").Select("ifnull(sum(prompt_tokens),0) + ifnull(sum(completion_tokens),0)")
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	tx.Where("type = ?", LogTypeConsume).Scan(&token)
	return token
}

func parseRiskStatusCode(log *Log) int {
	if log == nil {
		return 0
	}
	if log.Type == LogTypeConsume {
		return 200
	}
	otherMap, _ := common.StrToMap(log.Other)
	if otherMap == nil {
		return 0
	}
	raw, ok := otherMap["status_code"]
	if !ok {
		return 0
	}
	switch v := raw.(type) {
	case int:
		return v
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	case string:
		return common.String2Int(v)
	}
	return 0
}

func parseRiskErrorCode(log *Log) string {
	if log == nil {
		return ""
	}
	otherMap, _ := common.StrToMap(log.Other)
	if otherMap == nil {
		return ""
	}
	raw, ok := otherMap["error_code"]
	if !ok {
		return ""
	}
	if value, ok := raw.(string); ok {
		return value
	}
	return fmt.Sprintf("%v", raw)
}

func parseRiskOtherMap(log *Log) map[string]interface{} {
	if log == nil {
		return nil
	}
	otherMap, _ := common.StrToMap(log.Other)
	return otherMap
}

func fillRiskSummary(summary *UserRequestRiskSummary) {
	if summary == nil {
		return
	}
	summary.TotalRequests = summary.SuccessCount + summary.ErrorCount
	if summary.TotalRequests <= 0 {
		summary.ErrorRate = 0
		summary.RiskLevel = "low"
		return
	}
	summary.ErrorRate = float64(summary.ErrorCount) * 100 / float64(summary.TotalRequests)
	switch {
	case summary.Status429 >= 20 || summary.Status401+summary.Status403 >= 10 || summary.Status4xx*100 >= summary.TotalRequests*30 || (summary.ErrorCount >= 50 && summary.ErrorCount*100 >= summary.TotalRequests*20):
		summary.RiskLevel = "high"
	case summary.Status429 >= 5 || summary.Status4xx*100 >= summary.TotalRequests*10 || summary.Status422 >= 10:
		summary.RiskLevel = "medium"
	default:
		summary.RiskLevel = "low"
	}
}

func GetUserRequestRiskSummary(userId int, days int) (*UserRequestRiskSummary, error) {
	if days <= 0 {
		days = 7
	}
	startTimestamp := time.Now().AddDate(0, 0, -days).Unix()
	var logs []*Log
	err := LOG_DB.Where("user_id = ? AND created_at >= ? AND type IN ?", userId, startTimestamp, []int{LogTypeConsume, LogTypeError}).
		Order("id desc").
		Find(&logs).Error
	if err != nil {
		return nil, err
	}
	summary := &UserRequestRiskSummary{UserId: userId}
	for _, log := range logs {
		statusCode := parseRiskStatusCode(log)
		if log.Type == LogTypeConsume {
			summary.SuccessCount++
			summary.Status2xx++
			continue
		}
		summary.ErrorCount++
		switch {
		case statusCode >= 200 && statusCode < 300:
			summary.Status2xx++
			summary.SuccessCount++
			summary.ErrorCount--
		case statusCode >= 400 && statusCode < 500:
			summary.Status4xx++
		case statusCode >= 500 && statusCode < 600:
			summary.Status5xx++
		}
		switch statusCode {
		case 401:
			summary.Status401++
		case 403:
			summary.Status403++
		case 422:
			summary.Status422++
		case 429:
			summary.Status429++
		}
	}
	fillRiskSummary(summary)
	return summary, nil
}

func GetUsersRequestRiskSummary(userIds []int, days int) (map[int]*UserRequestRiskSummary, error) {
	result := make(map[int]*UserRequestRiskSummary, len(userIds))
	if len(userIds) == 0 {
		return result, nil
	}
	if days <= 0 {
		days = 7
	}
	startTimestamp := time.Now().AddDate(0, 0, -days).Unix()
	var logs []*Log
	err := LOG_DB.Where("user_id IN ? AND created_at >= ? AND type IN ?", userIds, startTimestamp, []int{LogTypeConsume, LogTypeError}).
		Order("id desc").
		Find(&logs).Error
	if err != nil {
		return nil, err
	}
	for _, userId := range userIds {
		result[userId] = &UserRequestRiskSummary{UserId: userId, RiskLevel: "low"}
	}
	for _, log := range logs {
		summary, ok := result[log.UserId]
		if !ok {
			summary = &UserRequestRiskSummary{UserId: log.UserId, RiskLevel: "low"}
			result[log.UserId] = summary
		}
		statusCode := parseRiskStatusCode(log)
		if log.Type == LogTypeConsume {
			summary.SuccessCount++
			summary.Status2xx++
			continue
		}
		summary.ErrorCount++
		switch {
		case statusCode >= 200 && statusCode < 300:
			summary.Status2xx++
			summary.SuccessCount++
			summary.ErrorCount--
		case statusCode >= 400 && statusCode < 500:
			summary.Status4xx++
		case statusCode >= 500 && statusCode < 600:
			summary.Status5xx++
		}
		switch statusCode {
		case 401:
			summary.Status401++
		case 403:
			summary.Status403++
		case 422:
			summary.Status422++
		case 429:
			summary.Status429++
		}
	}
	for _, summary := range result {
		fillRiskSummary(summary)
	}
	return result, nil
}

func GetUserRiskLogs(userId int, days int, startIdx int, num int) ([]*UserRiskLogItem, int64, error) {
	if days <= 0 {
		days = 7
	}
	startTimestamp := time.Now().AddDate(0, 0, -days).Unix()
	var logs []*Log
	err := LOG_DB.Where("user_id = ? AND created_at >= ? AND type = ?", userId, startTimestamp, LogTypeError).
		Order("id desc").
		Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}
	items := make([]*UserRiskLogItem, 0, len(logs))
	channelIds := types.NewSet[int]()
	for _, log := range logs {
		statusCode := parseRiskStatusCode(log)
		if statusCode >= 200 && statusCode < 300 {
			continue
		}
		otherMap := parseRiskOtherMap(log)
		item := &UserRiskLogItem{
			Id:         log.Id,
			CreatedAt:  log.CreatedAt,
			StatusCode: statusCode,
			ErrorCode:  parseRiskErrorCode(log),
			Content:    log.Content,
			ModelName:  log.ModelName,
			TokenName:  log.TokenName,
			Quota:      log.Quota,
			UseTime:    log.UseTime,
			IsStream:   log.IsStream,
			ChannelId:  log.ChannelId,
			Ip:         log.Ip,
			RequestId:  log.RequestId,
			Group:      log.Group,
		}
		if otherMap != nil {
			if preview, ok := otherMap["request_preview"].(string); ok {
				item.RequestPreview = preview
			}
			if truncated, ok := otherMap["request_preview_truncated"].(bool); ok {
				item.RequestPreviewTruncated = truncated
			}
			switch v := otherMap["request_body_size"].(type) {
			case int:
				item.RequestBodySize = int64(v)
			case int32:
				item.RequestBodySize = int64(v)
			case int64:
				item.RequestBodySize = v
			case float64:
				item.RequestBodySize = int64(v)
			}
			if contentType, ok := otherMap["request_content_type"].(string); ok {
				item.RequestContentType = contentType
			}
		}
		if log.ChannelId != 0 {
			channelIds.Add(log.ChannelId)
		}
		items = append(items, item)
	}
	if channelIds.Len() > 0 {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
			return nil, 0, err
		}
		channelMap := make(map[int]string, len(channels))
		for _, channel := range channels {
			channelMap[channel.Id] = channel.Name
		}
		for _, item := range items {
			item.ChannelName = channelMap[item.ChannelId]
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Id > items[j].Id
	})
	total := int64(len(items))
	if startIdx >= len(items) {
		return []*UserRiskLogItem{}, total, nil
	}
	endIdx := startIdx + num
	if endIdx > len(items) {
		endIdx = len(items)
	}
	return items[startIdx:endIdx], total, nil
}

func DeleteOldLog(ctx context.Context, targetTimestamp int64, limit int) (int64, error) {
	var total int64 = 0

	for {
		if nil != ctx.Err() {
			return total, ctx.Err()
		}

		result := LOG_DB.Where("created_at < ?", targetTimestamp).Limit(limit).Delete(&Log{})
		if nil != result.Error {
			return total, result.Error
		}

		total += result.RowsAffected

		if result.RowsAffected < int64(limit) {
			break
		}
	}

	return total, nil
}