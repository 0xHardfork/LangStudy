package auth

import (
	"net/http"
	"strings"

	"github.com/0xHardfork/langstudy/internal/user"
	"github.com/0xHardfork/langstudy/platform/config"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func JWTMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			response.Fail(c, http.StatusUnauthorized, "missing or invalid authorization header")
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(cfg.JWT.Secret), nil
		})

		if err != nil || !token.Valid {
			response.Fail(c, http.StatusUnauthorized, "invalid token")
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			response.Fail(c, http.StatusUnauthorized, "invalid token claims")
			c.Abort()
			return
		}

		userIDFloat, ok := claims["user_id"].(float64)
		if !ok {
			response.Fail(c, http.StatusUnauthorized, "invalid user_id in token")
			c.Abort()
			return
		}

		c.Set("userID", uint(userIDFloat))
		c.Next()
	}
}

func AdminRequired(userStore user.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, exists := c.Get("userID")
		if !exists {
			response.Fail(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		userID, ok := raw.(uint)
		if !ok {
			response.Fail(c, http.StatusInternalServerError, "invalid user id in context")
			c.Abort()
			return
		}
		u, err := userStore.GetByID(c.Request.Context(), userID)
		if err != nil {
			response.Fail(c, http.StatusForbidden, "forbidden: user not found")
			c.Abort()
			return
		}
		if u.Role != "admin" {
			response.Fail(c, http.StatusForbidden, "forbidden: admin privileges required")
			c.Abort()
			return
		}
		c.Next()
	}
}

