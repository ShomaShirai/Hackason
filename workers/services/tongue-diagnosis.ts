export interface TongueDiagnosisResult {
  overall_assessment: string;
  tongue_color: string;
  tongue_coating: string;
  tongue_shape: string;
  moisture_level: string;
  constitutional_type: string;
  recommended_treatment: string;
  dietary_recommendations: string;
  lifestyle_advice: string;
  urgency_level: 'low' | 'medium' | 'high';
  confidence_score: number;
  analyzed_at: string;
}

// Gemini APIのレスポンス型を定義
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export class TongueDiagnosisService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeTongue(imageBase64: string, symptoms?: string): Promise<TongueDiagnosisResult> {
    const prompt = this.createDiagnosisPrompt(symptoms);

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2000,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      // 型アサーションでGeminiResponseとして扱う
      const data = await response.json() as GeminiResponse;
      const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!analysisText) {
        console.error('Gemini APIレスポンス:', JSON.stringify(data, null, 2));
        throw new Error('舌診分析結果を取得できませんでした');
      }

      const result = this.parseAnalysisResult(analysisText);
      result.analyzed_at = new Date().toISOString();

      return result;
    } catch (error) {
      console.error('舌診分析エラー:', error);
      throw new Error(`舌診分析中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  private createDiagnosisPrompt(symptoms?: string): string {
    const symptomsContext = symptoms ? `患者の主訴: "${symptoms}"` : '';

    return `あなたは東洋医学の舌診専門家です。提供された舌の画像を詳細に分析し、医師向けの診断参考情報を提供してください。

${symptomsContext}

以下のJSON形式で回答してください：

\`\`\`json
{
  "overall_assessment": "舌の全体的な状態の評価（東洋医学的見解、200文字以内）",
  "tongue_color": "舌の色（淡紅、紅、暗紅、紫暗など）と病理的意義",
  "tongue_coating": "舌苔の状態（薄白、厚白、黄苔、黒苔、無苔など）と分布",
  "tongue_shape": "舌の形状（正常、胖大、痩薄、歯痕、裂紋など）の詳細",
  "moisture_level": "舌の潤燥状態（潤、燥、滑など）と体液代謝評価",
  "constitutional_type": "東洋医学的体質（気虚、血瘀、痰湿、陰虚、陽虚など）",
  "recommended_treatment": "推奨治療方針（漢方処方案、鍼灸、生活指導）",
  "dietary_recommendations": "体質に応じた食事療法（避けるべき食材、推奨食材）",
  "lifestyle_advice": "生活習慣改善の具体的提案",
  "urgency_level": "low",
  "confidence_score": 0.85
}
\`\`\`

分析基準：
- 東洋医学の舌診理論に基づく
- 舌色、舌苔、舌形、舌態を総合評価
- 病因病機論を適用した体質判定
- 信頼度は画像品質と判定確実性で評価（0-1の範囲）
- urgency_levelは"low", "medium", "high"のいずれか`;
  }

  private parseAnalysisResult(analysisText: string): TongueDiagnosisResult {
    try {
      // JSONブロックを抽出
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/) ||
        analysisText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr) as any;

        return {
          overall_assessment: parsed.overall_assessment || '舌診分析を実施しました',
          tongue_color: parsed.tongue_color || '色調要観察',
          tongue_coating: parsed.tongue_coating || '舌苔状態要確認',
          tongue_shape: parsed.tongue_shape || '形状要評価',
          moisture_level: parsed.moisture_level || '潤燥状態要確認',
          constitutional_type: parsed.constitutional_type || '体質要判定',
          recommended_treatment: parsed.recommended_treatment || '東洋医学的治療検討',
          dietary_recommendations: parsed.dietary_recommendations || '食事指導検討',
          lifestyle_advice: parsed.lifestyle_advice || '生活指導検討',
          urgency_level: this.validateUrgencyLevel(parsed.urgency_level),
          confidence_score: Math.max(0, Math.min(1, Number(parsed.confidence_score) || 0.7)),
          analyzed_at: new Date().toISOString()
        };
      }

      console.warn('JSONパースに失敗、フォールバック結果を返します');
      return this.createFallbackResult();
    } catch (error) {
      console.error('舌診結果パースエラー:', error);
      return this.createFallbackResult();
    }
  }

  private validateUrgencyLevel(level: any): 'low' | 'medium' | 'high' {
    return ['low', 'medium', 'high'].includes(level) ? level : 'medium';
  }

  private createFallbackResult(): TongueDiagnosisResult {
    return {
      overall_assessment: '舌診画像の分析を実施。詳細は手動確認を推奨',
      tongue_color: '画像品質により詳細評価困難',
      tongue_coating: '舌苔詳細評価要直接観察',
      tongue_shape: '形状正確判定要追加検査',
      moisture_level: '潤燥状態評価要直接観察',
      constitutional_type: '体質判定要総合診察',
      recommended_treatment: '個別治療計画策定推奨',
      dietary_recommendations: '体質病状合わせ食事指導実施推奨',
      lifestyle_advice: '生活環境考慮改善指導実施推奨',
      urgency_level: 'medium',
      confidence_score: 0.5,
      analyzed_at: new Date().toISOString()
    };
  }
}
