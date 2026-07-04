package dialogue

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
)

// voiceMap maps language code and speaker role to an edge-tts voice name.
// Speaker A = female, Speaker B = male (consistent with generate_audio.py).
var voiceMap = map[string]map[string]string{
	"ja": {"A": "ja-JP-NanamiNeural", "B": "ja-JP-KeitaNeural"},
	"en": {"A": "en-US-JennyNeural", "B": "en-US-GuyNeural"},
	"ko": {"A": "ko-KR-SunHiNeural", "B": "ko-KR-InJoonNeural"},
	"fr": {"A": "fr-FR-DeniseNeural", "B": "fr-FR-HenriNeural"},
	"de": {"A": "de-DE-KatjaNeural", "B": "de-DE-ConradNeural"},
	"es": {"A": "es-ES-ElviraNeural", "B": "es-ES-AlvaroNeural"},
}

// edgeTTSBin resolves the edge-tts binary path (cached after first call).
// Priority: project .venv/bin/edge-tts → system PATH.
var (
	edgeTTSBinOnce sync.Once
	edgeTTSBinPath string
)

func edgeTTSBin() string {
	edgeTTSBinOnce.Do(func() {
		binName := "edge-tts"
		if runtime.GOOS == "windows" {
			binName = "edge-tts.exe"
		}
		// Server is started from backend/, so project root is ../
		candidates := []string{
			filepath.Join("..", ".venv", "bin", binName), // run from backend/
			filepath.Join(".venv", "bin", binName),       // run from project root
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				if abs, err := filepath.Abs(c); err == nil {
					edgeTTSBinPath = abs
					return
				}
			}
		}
		// Fallback: rely on system PATH
		edgeTTSBinPath = "edge-tts"
	})
	return edgeTTSBinPath
}

// generateAudio calls the edge-tts CLI to generate a single MP3 for the given text.
// outputPath is a relative path (stored in DB); parent directories are created as needed.
// Returns nil on success. Caller should log a warning and continue if this fails.
func generateAudio(ctx context.Context, text, language, speaker, outputPath string) error {
	voices, ok := voiceMap[language]
	if !ok {
		voices = voiceMap["en"]
	}
	voice, ok := voices[speaker]
	if !ok {
		voice = "en-US-JennyNeural" // fallback
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return fmt.Errorf("mkdir for audio: %w", err)
	}

	bin := edgeTTSBin()
	cmd := exec.CommandContext(ctx, bin,
		"--voice", voice,
		"--text", text,
		"--write-media", outputPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("edge-tts [%s]: %w — output: %s", bin, err, string(out))
	}
	return nil
}
