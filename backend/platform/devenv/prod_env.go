//go:build !dev

package devenv

import "context"

func Setup(_ context.Context) (func(), error) {
	return func() {}, nil
}
