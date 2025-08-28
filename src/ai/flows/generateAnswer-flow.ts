'use server';
/**
 * @fileOverview A flow for generating an AI-powered answer to a customer's message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateAnswerInputSchema = z.object({
  customerName: z.string().describe("The name of the customer who sent the message."),
  productName: z.string().describe("The name of the product the customer is interested in."),
  message: z.string().describe("The message received from the customer."),
});
export type GenerateAnswerInput = z.infer<typeof GenerateAnswerInputSchema>;

const GenerateAnswerOutputSchema = z.object({
  answer: z.string().describe("The generated answer to be sent back to the customer."),
});
export type GenerateAnswerOutput = z.infer<typeof GenerateAnswerOutputSchema>;

// Define the prompt for generating the answer
const generateAnswerPrompt = ai.definePrompt({
  name: 'generateAnswerPrompt',
  input: {
    schema: GenerateAnswerInputSchema,
  },
  output: {
    schema: GenerateAnswerOutputSchema,
  },
  prompt: `Você é um assistente de vendas especialista, amigável e muito prestativo. Seu objetivo é responder às dúvidas de um cliente que demonstrou interesse em um produto, mas abandonou o carrinho.

Você já enviou uma mensagem inicial para reengajar o cliente, e ele acabou de responder. Agora, você precisa continuar a conversa de forma natural e convincente, não há necessidade de mandar uma saudação com o nome dele.

Responda à pergunta do cliente de forma clara e direta.
Mantenha um tom amigável e ajude o cliente.
Seja conciso.
Se a pergunta não for sobre o produto, tente educadamente redirecionar a conversa de volta para a venda.
No final da sua resposta, sempre tente incentivar o cliente a tomar a próxima ação (por exemplo, "Posso te ajudar com mais alguma coisa?" ou "Quer que eu te envie o link para finalizar a compra?").

Contexto da Conversa:
- Produto de Interesse: {{{productName}}}
- Mensagem do Cliente: "{{{message}}}"

Gere apenas o texto da resposta a ser enviada.`,
});


export async function generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
  return generateAnswerFlow(input);
}


const generateAnswerFlow = ai.defineFlow(
  {
    name: 'generateAnswerFlow',
    inputSchema: GenerateAnswerInputSchema,
    outputSchema: GenerateAnswerOutputSchema,
  },
  async (input) => {
    console.log(`Generating answer for ${input.customerName} about ${input.productName}...`);
    
    try {
        const { output } = await generateAnswerPrompt(input);

        if (!output?.answer) {
            console.error(`AI failed to generate an answer for input:`, input);
            return { answer: "Desculpe, não consegui pensar em uma boa resposta para isso. Poderia reformular a sua pergunta?" };
        }
        
        console.log(`AI generated answer: "${output.answer}"`);
        return { answer: output.answer };

    } catch (error) {
       console.error(`Error in generateAnswerFlow:`, error);
       // Return a generic, safe response in case of an error
       return { answer: "Estou com um pouco de dificuldade para processar sua mensagem. Você poderia tentar novamente em um instante?" };
    }
  }
);
