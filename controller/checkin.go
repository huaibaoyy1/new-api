package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func sha256Hex(input string) string {
	sum := sha256.Sum256([]byte(input))
	return hex.EncodeToString(sum[:])
}

func generateDailyCheckinNonce(userId int, date string) string {
	return sha256Hex(fmt.Sprintf("%d:%s:%s", userId, date, common.CryptoSecret))
}

func validateCheckinSignature(c *gin.Context, userId int) error {
	timestampHeader := strings.TrimSpace(c.GetHeader("X-Checkin-Timestamp"))
	signatureHeader := strings.TrimSpace(c.GetHeader("X-Checkin-Signature"))
	if timestampHeader == "" || signatureHeader == "" {
		return fmt.Errorf("缺少签到签名请求头")
	}
	timestamp, err := strconv.ParseInt(timestampHeader, 10, 64)
	if err != nil {
		return fmt.Errorf("签到时间戳格式错误")
	}
	now := time.Now().Unix()
	if timestamp < now-120 || timestamp > now+120 {
		return fmt.Errorf("签到签名已过期")
	}
	nonceDate := time.Now().Format("2006-01-02")
	nonce := generateDailyCheckinNonce(userId, nonceDate)
	expectedSignature := sha256Hex(fmt.Sprintf("%d:%d:%s", userId, timestamp, nonce))
	if !strings.EqualFold(signatureHeader, expectedSignature) {
		return fmt.Errorf("签到签名校验失败")
	}
	return nil
}

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}
	userId := c.GetInt("id")
	// 获取月份参数，默认为当前月份
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	nonceDate := time.Now().Format("2006-01-02")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":      setting.Enabled,
			"min_quota":    setting.MinQuota,
			"max_quota":    setting.MaxQuota,
			"stats":        stats,
			"checkin_nonce": generateDailyCheckinNonce(userId, nonceDate),
			"nonce_date":   nonceDate,
		},
	})
}

// DoCheckin 执行用户签到
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}

	userId := c.GetInt("id")
	if err := validateCheckinSignature(c, userId); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	checkin, err := model.UserCheckin(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("用户签到，获得额度 %s", logger.LogQuota(checkin.QuotaAwarded)))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "签到成功",
		"data": gin.H{
			"quota_awarded": checkin.QuotaAwarded,
			"checkin_date":  checkin.CheckinDate},
	})
}