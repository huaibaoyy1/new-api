package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func ClaimGameRelief(c *gin.Context) {
	if !model.IsGamesEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "游戏板块总开关未开启",
		})
		return
	}

	result, err := model.ClaimGameRelief(c.GetInt("id"))
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
