export interface AnswerBlock {
  answer: string;
  question: string;
}

export interface CheaperItem {
  image?: string
  price: number
  title: string
  url: string
}

// New types for "cheaper items" feature
export interface CheaperRequest {
  query: string
}

export interface CheaperResponse {
  query: string
  results: CheaperItem[]
}

export interface ExtractAndAnswerResponse {
  answers: AnswerBlock[];
  extracted: ExtractQAResponse;
}

export interface ExtractQARequest {
  html: string;
}

export interface ExtractQAResponse {
  meta: {
    extracted: number;
    incomplete: number;
  };
  questions: QuestionBlock[];
}

export interface GenerateReplyRequest {
  context: {
    description: string
    instructions: string
    name: string
    tone: string
  }
  text: string
}

export interface GenerateReplyResponse {
  reply: string
}

export interface QuestionBlock {
  complete: boolean;
  note?: string;
  options: string[];
  question: string;
}
