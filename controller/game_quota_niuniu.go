package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type quotaNiuniuCreateRoundRequest struct {
	BetAmount int    `json:"bet_amount"`
	TableSize int    `json:"table_size"`
	Mode      string `json:"mode"`
}

func ensureQuotaNiuniuEnabled(c *gin.Context) bool {
	if !model.IsGamesEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "游戏模块总开关未开启",
		})
		return false
	}
	if !model.IsQuotaNiuniuEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "额度斗牛未开启",
		})
		return false
	}
	return true
}

func GetQuotaNiuniuStatus(c *gin.Context) {
	if !ensureQuotaNiuniuEnabled(c) {
		return
	}

	status, err := model.GetQuotaNiuniuStatus(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    status,
	})
}

func CreateQuotaNiuniuRound(c *gin.Context) {
	if !ensureQuotaNiuniuEnabled(c) {
		return
	}

	var req quotaNiuniuCreateRoundRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数",
		})
		return
	}

	result, err := model.CreateQuotaNiuniuRound(c.GetInt("id"), req.BetAmount, req.TableSize, req.Mode)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

func SettleQuotaNiuniuRound(c *gin.Context) {
	if !ensureQuotaNiuniuEnabled(c) {
		return
	}

	roundId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.SettleQuotaNiuniuRound(c.GetInt("id"), roundId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}
