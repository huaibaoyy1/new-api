package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type quotaTreasureCreateRoundRequest struct {
	BetAmount int `json:"bet_amount"`
}

type quotaTreasurePickRequest struct {
	Position int `json:"position"`
}

func ensureQuotaTreasureEnabled(c *gin.Context) bool {
	if !model.IsGamesEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "游戏板块总开关未开启",
		})
		return false
	}
	if !model.IsQuotaTreasureEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "额度探宝未开启",
		})
		return false
	}
	return true
}

func GetQuotaTreasureStatus(c *gin.Context) {
	if !ensureQuotaTreasureEnabled(c) {
		return
	}

	status, err := model.GetQuotaTreasureStatus(c.GetInt("id"))
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

func CreateQuotaTreasureRound(c *gin.Context) {
	if !ensureQuotaTreasureEnabled(c) {
		return
	}

	var req quotaTreasureCreateRoundRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数",
		})
		return
	}

	result, err := model.CreateQuotaTreasureRound(c.GetInt("id"), req.BetAmount)
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

func PickQuotaTreasureNode(c *gin.Context) {
	if !ensureQuotaTreasureEnabled(c) {
		return
	}

	roundId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req quotaTreasurePickRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数",
		})
		return
	}

	result, err := model.PickQuotaTreasureNode(c.GetInt("id"), roundId, req.Position)
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

func CashoutQuotaTreasureRound(c *gin.Context) {
	if !ensureQuotaTreasureEnabled(c) {
		return
	}

	roundId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.CashoutQuotaTreasureRound(c.GetInt("id"), roundId)
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
