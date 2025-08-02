import type { Context } from "hono";
import { TongueDiagnosisService } from "../services/tongue-diagnosis";

export async function diagnoseTongue(c: Context) {
  console.log('🔍 舌診API呼び出し開始');

  try {
    const body = await c.req.json();
    const { image, symptoms } = body;

    console.log('📋 舌診API パラメータ:', {
      hasImage: !!image,
      imageType: image ? image.substring(0, 30) + '...' : 'なし',
      symptomsLength: symptoms ? symptoms.length : 0
    });

    if (!image) {
      console.warn('❌ 画像が提供されていません');
      return c.json({
        success: false,
        error: '舌の画像が提供されていません'
      }, 400);
    }

    if (!image.startsWith('data:image/')) {
      console.warn('❌ 無効な画像形式:', image.substring(0, 30));
      return c.json({
        success: false,
        error: '無効な画像形式です'
      }, 400);
    }

    // Gemini API Keyの確認
    if (!c.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY が設定されていません');
      return c.json({
        success: false,
        error: 'AI分析サービスが利用できません'
      }, 500);
    }

    const diagnosisService = new TongueDiagnosisService(c.env.GEMINI_API_KEY);

    console.log('🤖 Gemini API舌診分析開始...');
    const startTime = Date.now();

    const result = await diagnosisService.analyzeTongue(image, symptoms);

    const duration = Date.now() - startTime;
    console.log(`✅ 舌診分析完了 - 処理時間: ${duration}ms, 信頼度: ${result.confidence_score}`);

    return c.json({
      success: true,
      diagnosis: result,
      processing_time_ms: duration,
      message: '舌診分析完了（医師専用データ）'
    });

  } catch (error) {
    console.error('❌ 舌診APIエラー:', error);

    // エラーの詳細をログに出力
    if (error instanceof Error) {
      console.error('エラー詳細:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      });
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '舌診分析中に不明なエラーが発生しました',
      analyzed_at: new Date().toISOString()
    }, 500);
  }
}
