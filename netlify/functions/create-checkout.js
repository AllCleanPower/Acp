const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const body = JSON.parse(event.body);
    const { total, description } = body;

    if (!total || typeof total !== 'number' || total <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Montant total invalide' }) };
    }

    // Acompte = 15% du total, arrondi au centime, converti en centimes pour Stripe
    const acompteCents = Math.round(total * 0.15 * 100);

    if (acompteCents < 50) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Montant trop faible pour un paiement en ligne' }) };
    }

    const origin = event.headers.origin || event.headers.referer || 'https://allcleanpower.netlify.app';
    const successUrl = (body.successUrl && body.successUrl.startsWith(origin)) ? body.successUrl : `${origin}?payment=success`;
    const cancelUrl = (body.cancelUrl && body.cancelUrl.startsWith(origin)) ? body.cancelUrl : `${origin}?payment=cancelled`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: description || 'Acompte réservation All Clean Power',
            },
            unit_amount: acompteCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
