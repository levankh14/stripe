/**
 * payments.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet)
 * and Thorsten Schaeff (@thorwebdev).
 *
 * This modern JavaScript file handles the checkout process using Stripe.
 *
 * 1. It shows how to accept card payments with the `card` Element, and
 * the `paymentRequestButton` Element for Payment Request and Apple Pay.
 * 2. It shows how to use the Stripe Sources API to accept non-card payments,
 * such as iDEAL, SOFORT, SEPA Direct Debit, and more.
 */

(async () => {
  'use strict';

  // Retrieve the configuration for the store.
  const config = await store.getConfig();

  // Create references to the main form and its submit button.
  const form = document.getElementById('payment-form');
  const submitButton = form.querySelector('button[type=submit]');

  // Global variable to store the PaymentIntent object.
  let paymentIntent;

  /**
   * Setup Stripe Elements.
   */

  // Create a Stripe client.
  const stripe = Stripe(config.stripePublishableKey);

  // Create an instance of Elements.
  const elements = stripe.elements();

  // Prepare the styles for Elements.
  const style = {
    base: {
      iconColor: '#666ee8',
      color: '#31325f',
      fontWeight: 400,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '15px',
      '::placeholder': {
        color: '#aab7c4'
      },
      ':-webkit-autofill': {
        color: '#666ee8'
      }
    }
  };

  /**
   * Implement a Stripe Card Element that matches the look-and-feel of the app.
   *
   * This makes it easy to collect debit and credit card payments information.
   */

  // Create a Card Element and pass some custom styles to it.
  const card = elements.create('card', { style });

  // Mount the Card Element on the page.
  card.mount('#card-element');

  // Monitor change events on the Card Element to display any errors.
  card.on('change', ({ error }) => {
    const cardErrors = document.getElementById('card-errors');
    if (error) {
      cardErrors.textContent = error.message;
      cardErrors.classList.add('visible');
    } else {
      cardErrors.classList.remove('visible');
    }
    // Re-enable the Pay button.
    submitButton.disabled = false;
  });

  /**
   * Implement a Stripe Payment Request Button Element.
   *
   * This automatically supports the Payment Request API (already live on Chrome),
   * as well as Apple Pay on the Web on Safari, Google Pay, and Microsoft Pay.
   * When of these two options is available, this element adds a “Pay” button on top
   * of the page to let users pay in just a click (or a tap on mobile).
   */

  // Make sure all data is loaded from the store to compute the payment amount.
  await store.getPaymentData();

  // Create the payment request.
  const paymentRequest = stripe.paymentRequest({
    country: config.stripeCountry,
    currency: config.currency,
    total: {
      label: 'Total',
      amount: store.getPaymentTotal()
    },
    requestPayerEmail: true
  });

  // Callback when a payment method is created.
  paymentRequest.on('paymentmethod', async event => {
    // Confirm the PaymentIntent with the payment method returned from the payment request.
    const { error } = await stripe.confirmCardPayment(
      paymentIntent.client_secret,
      {
        payment_method: event.paymentMethod.id
        // shipping: {
        //   name: event.shippingAddress.recipient,
        //   phone: event.shippingAddress.phone
        // }
      },
      { handleActions: false }
    );
    if (error) {
      // Report to the browser that the payment failed.
      event.complete('fail');
      handlePayment({ error });
    } else {
      // Report to the browser that the confirmation was successful, prompting
      // it to close the browser payment method collection interface.
      event.complete('success');
      // Let Stripe.js handle the rest of the payment flow, including 3D Secure if needed.
      const response = await stripe.confirmCardPayment(paymentIntent.client_secret);
      handlePayment(response);
    }
  });

  // Create the Payment Request Button.
  const paymentRequestButton = elements.create('paymentRequestButton', {
    paymentRequest
  });

  // Check if the Payment Request is available (or Apple Pay on the Web).
  const paymentRequestSupport = await paymentRequest.canMakePayment();
  if (paymentRequestSupport) {
    // Display the Pay button by mounting the Element in the DOM.
    paymentRequestButton.mount('#payment-request-button');
    // Replace the instruction.
    document.querySelector('.instruction span').innerText = 'Or enter';
    // Show the payment request section.
    document.getElementById('payment-request').classList.add('visible');
  }

  /**
   * Handle the form submission.
   *
   * This uses Stripe.js to confirm the PaymentIntent using payment details collected
   * with Elements.
   *
   * Please note this form is not submitted when the user chooses the "Pay" button
   * or Apple Pay, Google Pay, and Microsoft Pay since they provide name and
   * shipping information directly.
   */

  // Submit handler for our payment form.
  form.addEventListener('submit', async event => {
    event.preventDefault();

    // Retrieve the user information from the form.
    const payment = form.querySelector('input[name=payment]:checked').value;
    const name = form.querySelector('input[name=name]').value;
    const email = form.querySelector('input[name=email]').value;
    // Disable the Pay button to prevent multiple click events.
    submitButton.disabled = true;
    submitButton.textContent = 'Processing…';

    if (payment === 'card') {
      // Let Stripe.js handle the confirmation of the PaymentIntent with the card Element.
      const response = await stripe.confirmCardPayment(paymentIntent.client_secret, {
        payment_method: {
          card,
          billing_details: {
            name,
            email
          }
        }
      });
      handlePayment(response);
    } else {
      // Prepare all the Stripe source common data.
      const sourceData = {
        type: payment,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        owner: {
          name,
          email
        },
        redirect: {
          return_url: window.location.href
        },
        statement_descriptor: 'Stripe Payments Demo',
        metadata: {
          paymentIntent: paymentIntent.id
        }
      };

      // Create a Stripe source with the common data and extra information.
      const { source } = await stripe.createSource(sourceData);
      handleSourceActiviation(source);
    }
  });

  // Handle new PaymentIntent result
  const handlePayment = paymentResponse => {
    const { paymentIntent, error } = paymentResponse;

    const mainElement = document.getElementById('main');
    const confirmationElement = document.getElementById('confirmation');

    if (error) {
      mainElement.classList.remove('processing');
      mainElement.classList.remove('receiver');
      confirmationElement.querySelector('.error-message').innerText = error.message;
      mainElement.classList.add('error');
    } else if (paymentIntent.status === 'succeeded') {
      // Success! Payment is confirmed. Update the interface to display the confirmation screen.
      mainElement.classList.remove('processing');
      mainElement.classList.remove('receiver');
      // Update the note about receipt and shipping (the payment has been fully confirmed by the bank).
      confirmationElement.querySelector('.note').innerText =
        'We just sent your receipt to your email address, and your items will be on their way shortly.';
      mainElement.classList.add('success');
    } else if (paymentIntent.status === 'processing') {
      // Success! Now waiting for payment confirmation. Update the interface to display the confirmation screen.
      mainElement.classList.remove('processing');
      // Update the note about receipt and shipping (the payment is not yet confirmed by the bank).
      confirmationElement.querySelector('.note').innerText =
        'We’ll send your receipt and ship your items as soon as your payment is confirmed.';
      mainElement.classList.add('success');
    } else {
      // Payment has failed.
      mainElement.classList.remove('success');
      mainElement.classList.remove('processing');
      mainElement.classList.remove('receiver');
      mainElement.classList.add('error');
    }
  };

  // Handle activation of payment sources not yet supported by PaymentIntents
  const handleSourceActiviation = source => {
    const mainElement = document.getElementById('main');
    const confirmationElement = document.getElementById('confirmation');
    switch (source.flow) {
      case 'none':
        // Normally, sources with a `flow` value of `none` are chargeable right away,
        // but there are exceptions, for instance for WeChat QR codes just below.
        break;
      case 'redirect':
        // Immediately redirect the customer.
        submitButton.textContent = 'Redirecting…';
        window.location.replace(source.redirect.url);
        break;
      case 'code_verification':
        // Display a code verification input to verify the source.
        break;
      case 'receiver':
        // Display the receiver address to send the funds to.
        mainElement.classList.add('success', 'receiver');
        // Poll the PaymentIntent status.
        pollPaymentIntentStatus(paymentIntent.id);
        break;
      default:
        // Customer's PaymentIntent is received, pending payment confirmation.
        break;
    }
  };

  /**
   * Monitor the status of a source after a redirect flow.
   *
   * This means there is a `source` parameter in the URL, and an active PaymentIntent.
   * When this happens, we'll monitor the status of the PaymentIntent and present real-time
   * information to the user.
   */

  const pollPaymentIntentStatus = async (paymentIntent, timeout = 30000, interval = 500, start = null) => {
    start = start ? start : Date.now();
    const endStates = ['succeeded', 'processing', 'canceled'];
    // Retrieve the PaymentIntent status from our server.
    const rawResponse = await fetch(`payment_intents/${paymentIntent}/status`);
    const response = await rawResponse.json();
    if (!endStates.includes(response.paymentIntent.status) && Date.now() < start + timeout) {
      // Not done yet. Let's wait and check again.
      setTimeout(pollPaymentIntentStatus, interval, paymentIntent, timeout, interval, start);
    } else {
      handlePayment(response);
      if (!endStates.includes(response.paymentIntent.status)) {
        // Status has not changed yet. Let's time out.
        console.warn(new Error('Polling timed out.'));
      }
    }
  };

  const url = new URL(window.location.href);
  const mainElement = document.getElementById('main');
  if (url.searchParams.get('source') && url.searchParams.get('client_secret')) {
    // Update the interface to display the processing screen.
    mainElement.classList.add('checkout', 'success', 'processing');

    const { source } = await stripe.retrieveSource({
      id: url.searchParams.get('source'),
      client_secret: url.searchParams.get('client_secret')
    });

    // Poll the PaymentIntent status.
    pollPaymentIntentStatus(source.metadata.paymentIntent);
  } else if (url.searchParams.get('payment_intent')) {
    // Poll the PaymentIntent status.
    pollPaymentIntentStatus(url.searchParams.get('payment_intent'));
  } else {
    // Update the interface to display the checkout form.
    mainElement.classList.add('checkout');

    // Create the PaymentIntent with the cart details.
    const response = await store.createPaymentIntent();
    paymentIntent = response.paymentIntent;
  }
  document.getElementById('main').classList.remove('loading');

  /**
   * Display the relevant payment methods for a selected country.
   */

  // List of relevant countries for the payment methods supported in this demo.
  // Read the Stripe guide: https://stripe.com/payments/payment-methods-guide
  const paymentMethods = {
    card: {
      name: 'Card',
      flow: 'none'
    }
  };

  // Update the main button to reflect the payment method being selected.
  const updateButtonLabel = async (paymentMethod, bankName) => {
    let amount = store.formatPrice(store.getPaymentTotal(), config.currency);
    let name = paymentMethods[paymentMethod].name;
    let label = `Pay ${amount}`;
    if (paymentMethod !== 'card') {
      label = `Pay ${amount} with ${name}`;
    }
    submitButton.innerText = label;
  };

  // Show only the payment methods that are relevant to the selected country.
  const showRelevantPaymentMethods = country => {
    const paymentInputs = form.querySelectorAll('input[name=payment]');
    for (let i = 0; i < paymentInputs.length; i++) {
      let input = paymentInputs[i];
      input.parentElement.classList.toggle(
        'visible',
        input.value === 'card' ||
          (config.paymentMethods.includes(input.value) &&
            paymentMethods[input.value].countries.includes(country) &&
            paymentMethods[input.value].currencies.includes(config.currency))
      );
    }

    // Hide the tabs if card is the only available option.
    const paymentMethodsTabs = document.getElementById('payment-methods');
    paymentMethodsTabs.classList.toggle('visible', paymentMethodsTabs.querySelectorAll('li.visible').length > 1);

    // Check the first payment option again.
    paymentInputs[0].checked = 'checked';
    form.querySelector('.payment-info.card').classList.add('visible');
    updateButtonLabel(paymentInputs[0].value);
  };

  // Listen to changes to the payment method selector.
  for (let input of document.querySelectorAll('input[name=payment]')) {
    input.addEventListener('change', event => {
      event.preventDefault();
      const payment = form.querySelector('input[name=payment]:checked').value;
      const flow = paymentMethods[payment].flow;

      // Update button label.
      updateButtonLabel(event.target.value);

      // Show the relevant details, whether it's an extra element or extra information for the user.
      form.querySelector('.payment-info.card').classList.toggle('visible', payment === 'card');
      document.getElementById('card-errors').classList.remove('visible', payment !== 'card');
    });
  }

  // Select the default country from the config on page load.
  let country = config.country;
  showRelevantPaymentMethods(country);
})();
