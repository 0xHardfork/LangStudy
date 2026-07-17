package subtitle

import (
	"fmt"
	"regexp"
	"strings"
)

// Matches timestamps like:
// 00:00:01,000 --> 00:00:04,000
// 00:01.000 --> 00:04.000
var timeRegex = regexp.MustCompile(`((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})`)
var assTimeRegex = regexp.MustCompile(`(\d+):(\d{2}):(\d{2})[.,](\d+)`)
var assStyleRegex = regexp.MustCompile(`\{[^\}]*\}`)

// ParsedBlock represents the intermediate parser result.
type ParsedBlock struct {
	Index     int
	StartTime string
	EndTime   string
	Text      string
}

// ParseSubtitle parses SRT, VTT or ASS content bytes.
func ParseSubtitle(contentBytes []byte) []ParsedBlock {
	var content string

	// Check for UTF-16LE BOM: FF FE
	if len(contentBytes) >= 2 && contentBytes[0] == 0xff && contentBytes[1] == 0xfe {
		content = decodeUTF16(contentBytes[2:], false)
	} else if len(contentBytes) >= 2 && contentBytes[0] == 0xfe && contentBytes[1] == 0xff {
		// Check for UTF-16BE BOM: FE FF
		content = decodeUTF16(contentBytes[2:], true)
	} else {
		// Assume UTF-8
		s := string(contentBytes)
		s = strings.TrimPrefix(s, "\xef\xbb\xbf")
		content = s
	}

	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.TrimSpace(content)

	if strings.Contains(content, "Dialogue:") {
		return parseASS(content)
	}

	return parseSRTOrVTT(content)
}

func decodeUTF16(b []byte, bigEndian bool) string {
	if len(b)%2 != 0 {
		b = b[:len(b)-1]
	}

	runes := make([]rune, 0, len(b)/2)
	for i := 0; i < len(b); i += 2 {
		var u16 uint16
		if bigEndian {
			u16 = (uint16(b[i]) << 8) | uint16(b[i+1])
		} else {
			u16 = uint16(b[i]) | (uint16(b[i+1]) << 8)
		}

		if u16 >= 0xD800 && u16 <= 0xDBFF {
			if i+3 < len(b) {
				var u16Next uint16
				if bigEndian {
					u16Next = (uint16(b[i+2]) << 8) | uint16(b[i+3])
				} else {
					u16Next = uint16(b[i+2]) | (uint16(b[i+3]) << 8)
				}
				if u16Next >= 0xDC00 && u16Next <= 0xDFFF {
					r := (rune(u16-0xD800) << 10) + rune(u16Next-0xDC00) + 0x10000
					runes = append(runes, r)
					i += 2
					continue
				}
			}
		}

		runes = append(runes, rune(u16))
	}

	return string(runes)
}

func parseSRTOrVTT(content string) []ParsedBlock {
	var blocks []ParsedBlock
	lines := strings.Split(content, "\n")

	var currentBlock *ParsedBlock
	var textLines []string

	index := 1
	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)

		// Check if time line
		m := timeRegex.FindStringSubmatch(trimmedLine)
		if len(m) == 3 {
			// Save previous block if exists
			if currentBlock != nil && len(textLines) > 0 {
				currentBlock.Text = strings.Join(textLines, " ")
				blocks = append(blocks, *currentBlock)
				index++
			}

			// Start new block
			startTime := normalizeTimeSRT(m[1])
			endTime := normalizeTimeSRT(m[2])
			currentBlock = &ParsedBlock{
				Index:     index,
				StartTime: startTime,
				EndTime:   endTime,
			}
			textLines = []string{}
			continue
		}

		// Text lines
		if currentBlock != nil {
			if trimmedLine == "" {
				if len(textLines) > 0 {
					currentBlock.Text = strings.Join(textLines, " ")
					blocks = append(blocks, *currentBlock)
					index++
					currentBlock = nil
					textLines = []string{}
				}
			} else {
				textLines = append(textLines, trimmedLine)
			}
		}
	}

	// Save last block
	if currentBlock != nil && len(textLines) > 0 {
		currentBlock.Text = strings.Join(textLines, " ")
		blocks = append(blocks, *currentBlock)
	}

	return blocks
}

func normalizeTimeSRT(tStr string) string {
	tStr = strings.TrimSpace(tStr)
	tStr = strings.ReplaceAll(tStr, ".", ",") // use comma for milliseconds
	if strings.Count(tStr, ":") == 1 {
		return "00:" + tStr
	}
	return tStr
}

func parseASS(content string) []ParsedBlock {
	var blocks []ParsedBlock
	lines := strings.Split(content, "\n")
	index := 1

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "Dialogue:") {
			continue
		}

		valPart := strings.TrimSpace(strings.TrimPrefix(line, "Dialogue:"))

		parts := strings.SplitN(valPart, ",", 10)
		if len(parts) < 10 {
			continue
		}

		startTimeRaw := parts[1]
		endTimeRaw := parts[2]
		textRaw := parts[9]

		text := assStyleRegex.ReplaceAllString(textRaw, "")
		text = strings.ReplaceAll(text, "\\N", " ")
		text = strings.ReplaceAll(text, "\\n", " ")
		text = strings.TrimSpace(text)

		if text == "" {
			continue
		}

		startTime := normalizeTime(startTimeRaw)
		endTime := normalizeTime(endTimeRaw)

		blocks = append(blocks, ParsedBlock{
			Index:     index,
			StartTime: startTime,
			EndTime:   endTime,
			Text:      text,
		})
		index++
	}

	return blocks
}

func normalizeTime(tStr string) string {
	m := assTimeRegex.FindStringSubmatch(strings.TrimSpace(tStr))
	if len(m) != 5 {
		return tStr
	}
	h := m[1]
	if len(h) < 2 {
		h = "0" + h
	}
	min := m[2]
	sec := m[3]
	ms := m[4]
	if len(ms) == 2 {
		ms = ms + "0"
	} else if len(ms) == 1 {
		ms = ms + "00"
	} else if len(ms) > 3 {
		ms = ms[:3]
	}
	return fmt.Sprintf("%s:%s:%s,%s", h, min, sec, ms)
}

// SplitBilingualText checks if the raw subtitle text is bilingual (Chinese & English)
// and splits them into clean target (English) and native (Chinese) text.
func SplitBilingualText(raw string) (target string, native string) {
	// First, normalize line breaks to \n
	raw = strings.ReplaceAll(raw, "\\N", "\n")
	raw = strings.ReplaceAll(raw, "\\n", "\n")

	lines := strings.Split(raw, "\n")
	var targetLines []string
	var nativeLines []string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Strip ASS formatting tags if present
		line = assStyleRegex.ReplaceAllString(line, "")
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Check if line contains Chinese characters
		hasChinese := false
		for _, r := range line {
			if r >= 0x4e00 && r <= 0x9fff {
				hasChinese = true
				break
			}
		}

		if hasChinese {
			nativeLines = append(nativeLines, line)
		} else {
			targetLines = append(targetLines, line)
		}
	}

	// If we found both target (English) and native (Chinese) lines
	if len(targetLines) > 0 && len(nativeLines) > 0 {
		return strings.Join(targetLines, " "), strings.Join(nativeLines, " ")
	}

	// Fallback: if no clear bilingual split, clean raw text as both
	cleanRaw := assStyleRegex.ReplaceAllString(raw, "")
	cleanRaw = strings.ReplaceAll(cleanRaw, "\n", " ")
	cleanRaw = strings.TrimSpace(cleanRaw)
	return cleanRaw, ""
}
