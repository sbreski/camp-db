const { Resend } = require('resend');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method not allowed',
    };
  }

  const { incident, participant } = JSON.parse(event.body);

  const resend = new Resend(process.env.RESEND_API_KEY);

  const subject = `Incident Report - ${participant.name}`;
  let body = `Dear ${participant.parentName || 'Parent/Guardian'},

Please find details of the incident involving ${participant.name}.

`;

  if (incident.pdfData) {
    // Download the PDF from Supabase
    const response = await fetch(incident.pdfData);
    const buffer = await response.arrayBuffer();
    const attachment = {
      filename: incident.pdfName,
      content: Buffer.from(buffer),
    };
  }

  body += `Incident Type: ${incident.type}
Date: ${new Date(incident.createdAt).toLocaleDateString('en-GB')}
Reported by: ${incident.staffMember || 'Staff'}

This email is being sent following our discussion about this incident.`;

  try {
    const data = await resend.emails.send({
      from: 'Camp Database <noreply@yourdomain.com>', // Replace with your verified domain
      to: participant.parentEmail,
      subject,
      text: body,
      attachments: incident.pdfData ? [attachment] : [],
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};