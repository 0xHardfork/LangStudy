#!/usr/bin/env python3
"""
Audio Generation Script for English Learning Dialogues
Uses edge-tts to generate English and Japanese audio from markdown dialogue files.
"""

import re
import os
import sys
import asyncio
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("Error: edge-tts not installed. Install with: pipx install edge-tts")
    sys.exit(1)


# Voice configurations - Multiple voices per language for different speakers
VOICES = {
    "en": {
        "male": [
            "en-US-GuyNeural",      # Deep, professional male voice
            "en-US-AndrewNeural",   # Younger, energetic male voice
        ],
        "female": [
            "en-US-JennyNeural",    # Friendly, warm female voice
            "en-US-AriaNeural",     # Professional, clear female voice
        ]
    },
    "ja": {
        "male": [
            "ja-JP-KeitaNeural",    # Natural Japanese male voice
        ],
        "female": [
            "ja-JP-NanamiNeural",   # Natural Japanese female voice
            "ja-JP-AoiNeural",      # Alternative Japanese female voice
        ]
    }
}


def extract_dialogue_section(markdown_content, language="english"):
    """
    Extract dialogue text from a specific language section in markdown table format.
    
    Args:
        markdown_content: Full markdown content
        language: 'english' or 'japanese'
    
    Returns:
        list: List of (speaker, text) tuples
    """
    if language.lower() == "english":
        # Find English Dialogue section
        pattern = r"## English Dialogue.*?\n(.*?)(?=\n##|$)"
    elif language.lower() == "japanese":
        # Find Japanese Dialogue section (without furigana)
        pattern = r"## Japanese Dialogue.*?\n(.*?)(?=\n##|$)"
    else:
        raise ValueError(f"Unsupported language: {language}")
    
    match = re.search(pattern, markdown_content, re.DOTALL)
    if not match:
        return []
    
    section_content = match.group(1).strip()
    
    # Extract dialogue lines from table format
    # Table format: | **Speaker**: text | translation |
    dialogue_lines = []
    in_table = False
    
    for line in section_content.split('\n'):
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
        
        # Check if we're in a table (starts with |)
        if line.startswith('|'):
            # Skip table header separators (----)
            if '---' in line:
                in_table = True
                continue
            
            # Skip table header row
            if ('English' in line and '中文' in line) or ('日本語' in line and '中文' in line):
                continue
            
            if in_table:
                # Extract first column (English or Japanese dialogue)
                # Format: | **Speaker**: text | translation |
                parts = line.split('|')
                if len(parts) >= 3:  # Should have at least: '', dialogue, translation, ''
                    dialogue_text = parts[1].strip()
                    # Extract speaker and text from **Speaker**: text format
                    # Support both half-width (:) and full-width (：) colons
                    speaker_match = re.match(r'\*\*(.+?)\*\*\s*[:：]\s*(.+)', dialogue_text)
                    if speaker_match:
                        speaker, text = speaker_match.groups()
                        dialogue_lines.append((speaker, text))
        else:
            # Stop processing when we leave the table
            if in_table:
                break
    
    return dialogue_lines


def assign_voices_to_speakers(dialogue_lines, language="en"):
    """
    Assign voices to different speakers, alternating male/female.
    
    Args:
        dialogue_lines: List of (speaker, text) tuples
        language: Language code ('en' or 'ja')
    
    Returns:
        dict: Mapping of speaker names to voice names
    """
    # Extract unique speakers in order of appearance
    speakers = []
    seen = set()
    for speaker, _ in dialogue_lines:
        if speaker not in seen:
            speakers.append(speaker)
            seen.add(speaker)
    
    voice_pool = VOICES.get(language, VOICES["en"])
    speaker_voices = {}
    
    # Assign voices alternating male/female
    for idx, speaker in enumerate(speakers):
        gender = "male" if idx % 2 == 0 else "female"
        # Use first available voice for each gender
        voice = voice_pool[gender][0]
        speaker_voices[speaker] = voice
    
    return speaker_voices


async def generate_multi_voice_audio(dialogue_lines, speaker_voices, output_file):
    """
    Generate audio file with multiple voices for different speakers using ffmpeg.
    
    Args:
        dialogue_lines: List of (speaker, text) tuples
        speaker_voices: Dict mapping speaker to voice name
        output_file: Output MP3 file path
    """
    import tempfile
    import subprocess
    
    # Create output directory if needed
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Generate audio segments for each line
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        segment_files = []
        
        for idx, (speaker, text) in enumerate(dialogue_lines):
            voice = speaker_voices.get(speaker, list(speaker_voices.values())[0])
            
            # Generate audio for this line
            segment_file = temp_path / f"segment_{idx:03d}.mp3"
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(segment_file))
            segment_files.append(segment_file)
        
        # Create concat file list for ffmpeg
        concat_file = temp_path / 'concat_list.txt'
        with open(concat_file, 'w') as f:
            for seg_file in segment_files:
                # ffmpeg concat requires proper escaping
                f.write(f"file '{seg_file.absolute()}'\n")
        
        # Use ffmpeg to concatenate all segments
        result = subprocess.run([
            'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(concat_file),
            '-c', 'copy', str(output_path)
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Error combining audio segments: {result.stderr}")
            return
        
        print(f"✓ Generated: {output_file}")


async def generate_single_voice_audio(text, output_file, voice):
    """
    Generate audio file from text using a single voice (fallback).
    
    Args:
        text: Text to convert to speech
        output_file: Output MP3 file path
        voice: Voice name to use
    """
    # Create output directory if needed
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output_path))
    
    print(f"✓ Generated: {output_file}")


async def process_dialogue_file(dialogue_file):
    """
    Process a single dialogue markdown file and generate audio files with multiple voices.
    
    Args:
        dialogue_file: Path to dialogue markdown file
    """
    dialogue_path = Path(dialogue_file)
    
    if not dialogue_path.exists():
        print(f"Error: File not found: {dialogue_file}")
        return False
    
    # Read markdown content
    with open(dialogue_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract base name (without extension)
    base_name = dialogue_path.stem
    output_dir = dialogue_path.parent
    
    print(f"\nProcessing: {dialogue_path.name}")
    
    # Extract English dialogue
    english_lines = extract_dialogue_section(content, "english")
    if english_lines:
        # Assign voices to speakers
        speaker_voices = assign_voices_to_speakers(english_lines, "en")
        
        # Print voice assignments
        voice_info = ', '.join([f"{s}({v.split('-')[-1]})" for s, v in speaker_voices.items()])
        print(f"  English speakers: {voice_info}")
        
        # Generate multi-voice audio
        output_file = output_dir / f"{base_name}-en.mp3"
        await generate_multi_voice_audio(english_lines, speaker_voices, output_file)
    else:
        print(f"  Warning: No English dialogue found")
    
    # Extract Japanese dialogue
    japanese_lines = extract_dialogue_section(content, "japanese")
    if japanese_lines:
        # Assign voices to speakers
        speaker_voices = assign_voices_to_speakers(japanese_lines, "ja")
        
        # Print voice assignments
        voice_info = ', '.join([f"{s}({v.split('-')[-1]})" for s, v in speaker_voices.items()])
        print(f"  Japanese speakers: {voice_info}")
        
        # Generate multi-voice audio
        output_file = output_dir / f"{base_name}-ja.mp3"
        await generate_multi_voice_audio(japanese_lines, speaker_voices, output_file)
    else:
        print(f"  Warning: No Japanese dialogue found")
    
    return True


async def process_directory(directory):
    """
    Process all dialogue markdown files in a directory.
    
    Args:
        directory: Path to directory containing dialogue files
    """
    dir_path = Path(directory)
    
    if not dir_path.exists():
        print(f"Error: Directory not found: {directory}")
        return
    
    # Find all markdown files (excluding README.md)
    dialogue_files = [
        f for f in dir_path.glob("*.md")
        if f.name != "README.md" and not f.name.startswith(".")
    ]
    
    if not dialogue_files:
        print(f"No dialogue files found in {directory}")
        return
    
    print(f"Found {len(dialogue_files)} dialogue file(s)")
    
    # Process each file
    for dialogue_file in dialogue_files:
        await process_dialogue_file(dialogue_file)
    
    print("\n✅ Audio generation complete!")


async def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python generate_audio.py <dialogue_file_or_directory>")
        print("\nExamples:")
        print("  python generate_audio.py 2026-01-31/")
        print("  python generate_audio.py 2026-01-31/cloud-security-review-meeting.md")
        sys.exit(1)
    
    target = sys.argv[1]
    target_path = Path(target)
    
    print("🎤 Audio Generation Script")
    print(f"Using voices: EN={VOICES['en']}, JA={VOICES['ja']}\n")
    
    if target_path.is_file():
        # Process single file
        await process_dialogue_file(target_path)
    elif target_path.is_dir():
        # Process directory
        await process_directory(target_path)
    else:
        print(f"Error: Invalid path: {target}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
