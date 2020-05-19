/**
 * store.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet)
 * and Thorsten Schaeff (@thorwebdev).
 *
 * Representation of products, and line items stored in Stripe.
 * Please note this is overly simplified class for demo purposes (all products
 * are loaded for convenience, there is no cart management functionality, etc.).
 * A production app would need to handle this very differently.
 */

class Store {
  constructor() {
    this.lineItems = [];
    this.PaymentData = { total: 0 };
    this.products = {};
    this.productsFetchPromise = null;
    this.displayPaymentSummary();
  }

  // Compute the total for the payment based on the line items (SKUs and quantity).
  async getPaymentData() {
    try {
      const response = await fetch('http://localhost:31314/api/web/stores/order/2?now=2019-10-09T13%3A32%3A11%2b02%3A00', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            first_name: 'Radoslaw',
            last_name: 'Peew',
            contact: '+359888788009'
          },
          userExtra: '',

          tip: 100,

          products: [
            {
              id: 9,
              count: 5,
              addons: [{ id: 8, count: 1, category_id: 7 }, { id: 10, count: 1, category_id: 5 }],
              notes: 'only fresh tomatos ;)'
            },
            {
              id: 7,
              count: 1,
              pointz: true,
              addons: [{ id: 8, count: 1, category_id: 6 }]
            }
          ]
        })
      });

      const data = await response.json();
      if (data.error) {
        return { error: data.error };
      } else {
        this.PaymentData = data.order;
        // return data;
      }
    } catch (err) {
      return { error: err.message };
    }
  }

  getPaymentTotal() {
    return this.PaymentData.total;
  }

  // Retrieve the configuration from the API.
  getConfig() {
    const config = {
      stripePublishableKey: 'pk_test_qJPsZ4dLNoMLpUPIvkBFzOeD',
      stripeCountry: 'US',
      country: 'US',
      currency: 'usd',
      paymentMethods: 'card'
    };

    return config;
  }

  // Create the PaymentIntent with the cart details.
  async createPaymentIntent() {
    try {
      console.log(this.PaymentData);
      const response = await fetch('http://localhost:31314/api/web/stores/pay?now=2019-09-23T17%3A55%3A40-04%3A00', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: this.PaymentData._id })
      });

      const data = await response.json();
      if (data.error) {
        return { error: data.error };
      } else {
        return data;
      }
    } catch (err) {
      return { error: err.message };
    }
  }

  // Format a price (assuming a two-decimal currency like EUR or USD for simplicity).
  formatPrice(amount, currency) {
    let price = (amount / 100).toFixed(2);
    let numberFormat = new Intl.NumberFormat(['en-US'], {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol'
    });

    return numberFormat.format(price);
  }

  // Manipulate the DOM to display the payment summary on the right panel.
  // Note: For simplicity, we're just using template strings to inject data in the DOM,
  // but in production you would typically use a library like React to manage this effectively.
  displayPaymentSummary() {
    // Add the subtotal and total to the payment summary.
    const orderTotal = document.getElementById('order-total');
    const total = this.formatPrice(this.getPaymentTotal(), 'usd');
    orderTotal.querySelector('[data-subtotal]').innerText = total;
    orderTotal.querySelector('[data-total]').innerText = total;
  }
}

window.store = new Store();
