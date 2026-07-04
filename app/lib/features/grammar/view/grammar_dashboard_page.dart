import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../cubit/grammar_cubit.dart';
import '../cubit/grammar_state.dart';

class GrammarDashboardPage extends StatefulWidget {
  const GrammarDashboardPage({super.key});

  @override
  State<GrammarDashboardPage> createState() => _GrammarDashboardPageState();
}

class _GrammarDashboardPageState extends State<GrammarDashboardPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _textController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<GrammarCubit>().loadHistory();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _textController.dispose();
    super.dispose();
  }

  void _submitAnalysis() {
    if (!_formKey.currentState!.validate()) return;

    final title = _titleController.text.trim();
    final text = _textController.text.trim();
    final cubit = context.read<GrammarCubit>();

    cubit.analyzeText(
      title: title,
      text: text,
      onSuccess: () {
        final state = cubit.state;
        if (state is GrammarLoaded && state.currentArticle != null) {
          final id = state.currentArticle!.id;
          _titleController.clear();
          _textController.clear();
          context.push('/grammar/article/$id');
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final grammarCubit = context.watch<GrammarCubit>();

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Text('📖 ', style: TextStyle(fontSize: 20)),
            Text('英语语法与文章分析', style: TextStyle(fontWeight: FontWeight.bold)),
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
        child: BlocBuilder<GrammarCubit, GrammarState>(
          builder: (context, state) {
            if (state is GrammarLoading) {
              return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
            }

            if (state is GrammarError) {
              return Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('加载历史库失败', style: TextStyle(fontSize: 16, color: Colors.redAccent, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text(state.message, style: const TextStyle(color: Colors.grey), textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => grammarCubit.loadHistory(),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurple),
                      child: const Text('重试', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            }

            if (state is GrammarLoaded) {
              final analyzing = state.analyzing;
              final error = state.error;

              return SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // New Analysis Form
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
                            const Text('✏️ 新增英文分析', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                            const SizedBox(height: 16),
                            const Text('文章标题', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _titleController,
                              validator: (val) => (val == null || val.trim().isEmpty) ? '请输入文章标题' : null,
                              decoration: InputDecoration(
                                hintText: '例如: Attributive Clause Study',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text('英文内容 (支持长文或句子)', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _textController,
                              maxLines: 6,
                              validator: (val) => (val == null || val.trim().isEmpty) ? '请输入英文内容' : null,
                              decoration: InputDecoration(
                                hintText: '请粘贴或输入你想分析的英文段落...',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                            if (error != null) ...[
                              const SizedBox(height: 12),
                              Text('⚠️ $error', style: const TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.bold)),
                            ],
                            const SizedBox(height: 20),
                            ElevatedButton(
                              onPressed: analyzing ? null : _submitAnalysis,
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                backgroundColor: Colors.deepPurple,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              child: analyzing
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                                    )
                                  : const Text('🚀 开始语法分析', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // History list
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('📚 共享语法库历史', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                        TextButton(
                          onPressed: () => grammarCubit.loadHistory(),
                          child: const Text('刷新', style: TextStyle(color: Colors.blueAccent)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (state.history.isEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 36),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A).withOpacity(0.3),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.grey.withOpacity(0.08)),
                        ),
                        child: const Center(
                          child: Text('暂无历史分析，赶紧上传第一篇吧！', style: TextStyle(color: Colors.grey)),
                        ),
                      )
                    else
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.history.length,
                        itemBuilder: (context, index) {
                          final art = state.history[index];
                          final timeStr = DateFormat('yyyy/MM/dd HH:mm').format(DateTime.parse(art.createdAt).toLocal());

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12.0),
                            child: InkWell(
                              onTap: () => context.push('/grammar/article/${art.id}'),
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  border: Border.all(color: Colors.grey.withOpacity(0.12)),
                                  borderRadius: BorderRadius.circular(16),
                                  color: const Color(0xFF0F172A).withOpacity(0.5),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Text(art.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white)),
                                    const SizedBox(height: 6),
                                    Text(
                                      art.rawText,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: Colors.grey, fontSize: 13),
                                    ),
                                    const SizedBox(height: 8),
                                    Text('📅 上传于 $timeStr', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
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
