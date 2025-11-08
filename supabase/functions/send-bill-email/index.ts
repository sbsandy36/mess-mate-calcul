import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  memberName: string;
  month: string;
  individualBill: string;
  overview: string;
  totalAmount: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, memberName, month, individualBill, overview, totalAmount }: EmailRequest = await req.json();

    const gmailEmail = Deno.env.get('GMAIL_EMAIL');
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!gmailEmail || !gmailPassword) {
      throw new Error('Gmail credentials not configured');
    }

    const emailBody = `Hello ${memberName},

Your mess bill for ${month} has been calculated.

${individualBill}

${overview}

Total Amount: Rs. ${totalAmount}

Thank you for your cooperation.

Best regards,
Santiniketan Mess Management`;

    // Using Gmail SMTP via API
    const response = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: gmailPassword,
        to: [to],
        sender: gmailEmail,
        subject: `Mess Bill - ${month}`,
        text_body: emailBody,
      }),
    });

    if (!response.ok) {
      console.error('Email send failed:', await response.text());
      throw new Error('Failed to send email');
    }

    console.log('Email sent successfully to:', to);

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in send-bill-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
