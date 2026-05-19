package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type goldenPokerCreateRoundRequest struct {
	BetAmount int `json:"bet_amount"`
}

func ensureGoldenPokerEnabled(c *gin.Context) bool {
	if !model.IsGamesEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "游戏板块总开关未开启",
		})
		return false
	}
	if !model.IsGoldenPokerEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "额度牌局未开启",
		})
		return false
	}
	return true
}

func GetGoldenPokerStatus(c *gin.Context) {
	if !ensureGoldenPokerEnabled(c) {
		return
	}

	status, err := model.GetGoldenPokerStatus(c.GetInt("id"))
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

func CreateGoldenPokerRound(c *gin.Context) {
	if !ensureGoldenPokerEnabled(c) {
		return
	}

	var req goldenPokerCreateRoundRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数",
		})
		return
	}

	result, err := model.CreateGoldenPokerRound(c.GetInt("id"), req.BetAmount)
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

func SwapGoldenPokerCard(c *gin.Context) {
	if !ensureGoldenPokerEnabled(c) {
		return
	}

	roundId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.SwapGoldenPokerCard(c.GetInt("id"), roundId)
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

func SettleGoldenPokerRound(c *gin.Context) {
	if !ensureGoldenPokerEnabled(c) {
		return
	}

	roundId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.SettleGoldenPokerRound(c.GetInt("id"), roundId)
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
