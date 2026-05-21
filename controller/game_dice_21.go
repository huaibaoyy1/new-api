package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type dice21CreateRoundRequest struct {
	BetAmount int `json:"bet_amount"`
}

func ensureDice21Enabled(c *gin.Context) bool {
	if !model.IsGamesEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "游戏模块总开关未开启",
		})
		return false
	}
	if !model.IsDice21Enabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "骰盅21未开启",
		})
		return false
	}
	return true
}

func GetDice21Status(c *gin.Context) {
	if !ensureDice21Enabled(c) {
		return
	}

	status, err := model.GetDice21Status(c.GetInt("id"))
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

func CreateDice21Round(c *gin.Context) {
	if !ensureDice21Enabled(c) {
		return
	}

	var req dice21CreateRoundRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数",
		})
		return
	}

	result, err := model.CreateDice21Round(c.GetInt("id"), req.BetAmount)
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

func RerollDice21Round(c *gin.Context) {
	if !ensureDice21Enabled(c) {
		return
	}

	roundId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.RerollDice21Round(c.GetInt("id"), roundId)
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

func SettleDice21Round(c *gin.Context) {
	if !ensureDice21Enabled(c) {
		return
	}

	roundId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.SettleDice21Round(c.GetInt("id"), roundId)
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
