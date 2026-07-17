import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import '../cubit/subtitle_cubit.dart';
import '../cubit/subtitle_state.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../auth/cubit/auth_state.dart';

class SubtitleDashboardPage extends StatefulWidget {
  const SubtitleDashboardPage({super.key});

  @override
  State<SubtitleDashboardPage> createState() => _SubtitleDashboardPageState();
}

class _SubtitleDashboardPageState extends State<SubtitleDashboardPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  String _targetLang = 'en';
  String _nativeLang = 'zh';

  String? _selectedFilePath;
  String? _selectedFileName;
  String _activeTab = 'my';

  final Map<String, String> _languages = {
    'en': '英语',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
  };

  @override
  void initState() {
    super.initState();
    final cubit = context.read<SubtitleCubit>();
    cubit.loadHistory();
    cubit.loadSharedHistory();
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['srt', 'vtt', 'ass'],
      );

      if (result != null && result.files.single.path != null) {
        setState(() {
          _selectedFilePath = result.files.single.path;
          _selectedFileName = result.files.single.name;
          if (_titleController.text.trim().isEmpty) {
            _titleController.text = _selectedFileName!.replaceFirst(RegExp(r'\.[^.]+$'), '');
          }
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('选择文件出错: $e')),
      );
    }
  }

  void _submitUpload() {
    if (!_formKey.currentState!.validate() || _selectedFilePath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先选择字幕文件')),
      );
      return;
    }

    final title = _titleController.text.trim();
    final cubit = context.read<SubtitleCubit>();

    cubit.uploadSubtitle(
      filePath: _selectedFilePath!,
      fileName: _selectedFileName!,
      title: title,
      targetLanguage: _targetLang,
      nativeLanguage: _nativeLang,
      onSuccess: () {
        final state = cubit.state;
        if (state is SubtitleLoaded && state.currentTopic != null) {
          final id = state.currentTopic!.id;
          setState(() {
            _selectedFilePath = null;
            _selectedFileName = null;
            _titleController.clear();
          });
          if (state.currentTopic!.status == 'pending') {
            context.push('/subtitle/progress/$id');
          } else {
            context.push('/subtitle/detail/$id');
          }
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final subtitleCubit = context.watch<SubtitleCubit>();

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Text('🎬 ', style: TextStyle(fontSize: 20)),
            Text('视频字幕翻译与语法分析', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
      ),
      body: SafeArea(
        child: BlocBuilder<SubtitleCubit, SubtitleState>(
          builder: (context, state) {
            if (state is SubtitleLoading) {
              return const Center(child: CircularProgressIndicator(color: Colors.blueAccent));
            }

            if (state is SubtitleError) {
              return Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('加载字幕库历史失败', style: TextStyle(fontSize: 16, color: Colors.redAccent, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text(state.message, style: const TextStyle(color: Colors.grey), textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => subtitleCubit.loadHistory(),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                      child: const Text('重试', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            }

            if (state is SubtitleLoaded) {
              final analyzing = state.analyzing;
              final error = state.error;

              return SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Upload card form
                    Form(
                      key: _formKey,
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.grey.withOpacity(0.1)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text('🎬 上传字幕文件', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                            const SizedBox(height: 16),
                            const Text('选择文件 (.srt / .vtt / .ass)', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            InkWell(
                              onTap: analyzing ? null : _pickFile,
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  border: Border.all(color: Colors.grey.withOpacity(0.2)),
                                  borderRadius: BorderRadius.circular(12),
                                  color: Colors.black.withOpacity(0.2),
                                ),
                                child: Row(
                                  children: [
                                     const Icon(Icons.attach_file, color: Color(0xFFF43F5E)),
                                     const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        _selectedFileName ?? '点击选择本地 SRT、VTT 或 ASS 文件',
                                        style: TextStyle(
                                          color: _selectedFileName != null ? Colors.white : Colors.grey,
                                          fontSize: 14,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text('字幕标题', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _titleController,
                              validator: (val) => (val == null || val.trim().isEmpty) ? '请输入字幕标题' : null,
                              decoration: InputDecoration(
                                hintText: '请输入字幕标题',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('所学语言', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 6),
                                      DropdownButtonFormField<String>(
                                        value: _targetLang,
                                        items: _languages.entries.map((e) {
                                          return DropdownMenuItem(value: e.key, child: Text(e.value));
                                        }).toList(),
                                        onChanged: (val) {
                                          if (val != null) setState(() => _targetLang = val);
                                        },
                                        decoration: InputDecoration(
                                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('您的母语', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 6),
                                      DropdownButtonFormField<String>(
                                        value: _nativeLang,
                                        items: const [
                                          DropdownMenuItem(value: 'zh', child: Text('中文')),
                                          DropdownMenuItem(value: 'en', child: Text('英语')),
                                        ],
                                        onChanged: (val) {
                                          if (val != null) setState(() => _nativeLang = val);
                                        },
                                        decoration: InputDecoration(
                                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            if (error != null) ...[
                              const SizedBox(height: 12),
                              Text('⚠️ $error', style: const TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.bold)),
                            ],
                            const SizedBox(height: 20),
                            ElevatedButton(
                              onPressed: analyzing ? null : _submitUpload,
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                backgroundColor: const Color(0xFFF43F5E),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              child: analyzing
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                                    )
                                  : const Text('🚀 开始翻译并深度分析', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // History list
                    Row(
                      children: [
                        InkWell(
                          onTap: () {
                            setState(() {
                              _activeTab = 'my';
                            });
                            context.read<SubtitleCubit>().loadHistory();
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _activeTab == 'my' ? const Color(0xFFF43F5E) : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                            ),
                            child: Text(
                              '📚 我的字幕 (${state.history.length})',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: _activeTab == 'my' ? const Color(0xFFF43F5E) : Colors.grey,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        InkWell(
                          onTap: () {
                            setState(() {
                              _activeTab = 'shared';
                            });
                            context.read<SubtitleCubit>().loadSharedHistory();
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _activeTab == 'shared' ? const Color(0xFFF43F5E) : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                            ),
                            child: Text(
                              '🌐 共享字幕库 (${state.sharedHistory.length})',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: _activeTab == 'shared' ? const Color(0xFFF43F5E) : Colors.grey,
                              ),
                            ),
                          ),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () {
                            if (_activeTab == 'my') {
                              context.read<SubtitleCubit>().loadHistory();
                            } else {
                              context.read<SubtitleCubit>().loadSharedHistory();
                            }
                          },
                          child: const Text('刷新', style: TextStyle(color: Color(0xFFF43F5E))),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (_activeTab == 'my') ...[
                      if (state.history.isEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 36),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A).withOpacity(0.3),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.withOpacity(0.08)),
                          ),
                          child: const Center(
                            child: Text('暂无历史分析，快去上传第一篇吧！', style: TextStyle(color: Colors.grey)),
                          ),
                        )
                      else
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: state.history.length,
                          itemBuilder: (context, index) {
                            final topic = state.history[index];
                            final timeStr = DateFormat('yyyy/MM/dd HH:mm').format(DateTime.parse(topic.createdAt).toLocal());

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12.0),
                              child: Container(
                                decoration: BoxDecoration(
                                  border: Border.all(color: Colors.grey.withOpacity(0.12)),
                                  borderRadius: BorderRadius.circular(16),
                                  color: const Color(0xFF0F172A).withOpacity(0.5),
                                ),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.all(16),
                                  title: Row(
                                    children: [
                                      Expanded(
                                        child: Text(topic.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white)),
                                      ),
                                      if (topic.isShared) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF10B981).withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                                          ),
                                          child: const Text('已分享', style: TextStyle(color: Color(0xFF10B981), fontSize: 9, fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ],
                                  ),
                                  subtitle: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const SizedBox(height: 6),
                                      Text('原文件名: ${topic.originalFileName}', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                                      const SizedBox(height: 8),
                                      Text('📅 创建于 $timeStr', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                    ],
                                  ),
                                  onTap: () {
                                    if (topic.status == 'pending') {
                                      context.push('/subtitle/progress/${topic.id}');
                                    } else {
                                      context.push('/subtitle/detail/${topic.id}');
                                    }
                                  },
                                  trailing: IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                                    onPressed: () async {
                                      final confirm = await showDialog<bool>(
                                        context: context,
                                        builder: (context) => AlertDialog(
                                          title: const Text('确定删除吗？'),
                                          content: const Text('这将永久删除这篇字幕的分析记录。'),
                                          actions: [
                                            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
                                            TextButton(
                                              onPressed: () => Navigator.pop(context, true),
                                              child: const Text('删除', style: TextStyle(color: Colors.redAccent)),
                                            ),
                                          ],
                                        ),
                                      );
                                      if (confirm == true) {
                                        subtitleCubit.deleteSubtitleTopic(topic.id);
                                      }
                                    },
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                    ] else ...[
                      if (state.sharedHistory.isEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 36),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A).withOpacity(0.3),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.withOpacity(0.08)),
                          ),
                          child: const Center(
                            child: Text('共享库暂无数据，分享你的第一篇吧！', style: TextStyle(color: Colors.grey)),
                          ),
                        )
                      else
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: state.sharedHistory.length,
                          itemBuilder: (context, index) {
                            final topic = state.sharedHistory[index];
                            final timeStr = DateFormat('yyyy/MM/dd HH:mm').format(DateTime.parse(topic.createdAt).toLocal());
                            final authState = context.watch<AuthCubit>().state;
                            int? currentUserId;
                            if (authState is AuthAuthenticated) {
                              currentUserId = authState.user.id;
                            }
                            final isOwner = topic.userId == currentUserId;

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12.0),
                              child: Container(
                                decoration: BoxDecoration(
                                  border: Border.all(color: Colors.grey.withOpacity(0.12)),
                                  borderRadius: BorderRadius.circular(16),
                                  color: const Color(0xFF0F172A).withOpacity(0.5),
                                ),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.all(16),
                                  title: Text(topic.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white)),
                                  subtitle: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const SizedBox(height: 6),
                                      Text('原文件名: ${topic.originalFileName}', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                                      const SizedBox(height: 8),
                                      Text('📅 创建于 $timeStr', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                    ],
                                  ),
                                  onTap: () {
                                    context.push('/subtitle/detail/${topic.id}');
                                  },
                                  trailing: isOwner
                                      ? IconButton(
                                          icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                                          onPressed: () async {
                                            final confirm = await showDialog<bool>(
                                              context: context,
                                              builder: (context) => AlertDialog(
                                                title: const Text('确定删除吗？'),
                                                content: const Text('这将永久删除这篇字幕的分析记录。'),
                                                actions: [
                                                  TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
                                                  TextButton(
                                                    onPressed: () => Navigator.pop(context, true),
                                                    child: const Text('删除', style: TextStyle(color: Colors.redAccent)),
                                                  ),
                                                ],
                                              ),
                                            );
                                            if (confirm == true) {
                                              subtitleCubit.deleteSubtitleTopic(topic.id);
                                            }
                                          },
                                        )
                                      : const Icon(Icons.share, color: Color(0xFF10B981), size: 18),
                                ),
                              ),
                            );
                          },
                        ),
                    ],
                  ],
                ),
              );
            }

            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}
