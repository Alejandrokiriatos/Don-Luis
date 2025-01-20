// Cart functionality
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function addToCart(productName, price, unit) {
  const existingItem = cart.find(item => item.name === productName && item.unit === unit);
  
  if (existingItem) {
    existingItem.quantity = (existingItem.quantity || 1) + 1;
  } else {
    cart.push({
      name: productName,
      price: price,
      unit: unit,
      quantity: 1
    });
  }
  
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  
  // Show confirmation animation
  const notification = document.createElement('div');
  notification.className = 'add-to-cart-notification';
  notification.innerHTML = '<i class="fas fa-check"></i> Producto añadido';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 2000);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  displayCart();
  updateCartCount();
}

function updateQuantity(index, delta) {
  cart[index].quantity = (cart[index].quantity || 1) + delta;
  
  if (cart[index].quantity < 1) {
    removeFromCart(index);
    return;
  }
  
  localStorage.setItem('cart', JSON.stringify(cart));
  displayCart();
  updateCartCount();
}

function updateCartCount() {
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    const totalItems = cart.reduce((total, item) => total + (item.quantity || 1), 0);
    cartCount.textContent = totalItems;
  }
}

function clearCart() {
  cart = [];
  localStorage.setItem('cart', JSON.stringify(cart));
  displayCart();
  updateCartCount();
}

function checkout() {
  // Check if cart is empty
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Añade productos antes de finalizar la compra.');
    return;
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'checkout-modal';
  
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Finalizar Compra</h2>
      <form id="checkout-form">
        <div class="form-group">
          <label for="name">Nombre Completo *</label>
          <input type="text" id="name" required>
        </div>
        <div class="form-group">
          <label for="phone">Número de Teléfono *</label>
          <input type="tel" id="phone" pattern="[0-9]{8}" title="Ingrese un número de teléfono válido de 8 dígitos" required>
        </div>
        <div class="form-group">
          <label for="address">Dirección de Entrega *</label>
          <textarea id="address" required></textarea>
        </div>
        <div class="modal-buttons">
          <button type="button" class="cancel-button" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="confirm-button">Confirmar Pedido</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Form submission handler
  document.getElementById('checkout-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Double check cart is not empty (in case it was cleared while modal was open)
    if (cart.length === 0) {
      alert('Tu carrito está vacío. Añade productos antes de finalizar la compra.');
      closeModal();
      return;
    }

    const formData = {
      name: document.getElementById('name').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value
    };

    // Create the WhatsApp message
    let message = `🛒 *Nuevo Pedido*\n\n`;
    message += `*Cliente:* ${formData.name}\n`;
    message += `*Teléfono:* ${formData.phone}\n`;
    message += `*Dirección:* ${formData.address}\n\n`;
    message += `*Productos:*\n`;

    let total = 0;
    cart.forEach(item => {
      const itemTotal = item.price * (item.quantity || 1);
      message += `- ${item.name} (${item.quantity || 1} ${item.unit}) - $${itemTotal}\n`;
      total += itemTotal;
    });

    message += `\n*Total:* $${total.toFixed(2)}`;

    // Encode the message for WhatsApp URL
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/5355841127?text=${encodedMessage}`;

    // Open WhatsApp in a new window
    window.open(whatsappUrl, '_blank');
    
    // Clear cart and close modal
    closeModal();
    clearCart();
    alert('¡Gracias por tu compra! Te redirigiremos a WhatsApp para confirmar tu pedido.');
  });
}

function closeModal() {
  const modal = document.querySelector('.checkout-modal');
  if (modal) {
    modal.remove();
  }
}

function displayCart() {
  const cartContainer = document.getElementById('cart-items');
  if (!cartContainer) return;

  cartContainer.innerHTML = '';
  let total = 0;

  if (cart.length === 0) {
    cartContainer.innerHTML = '<div class="empty-cart">El carrito está vacío</div>';
    document.getElementById('total').textContent = '$0';
    return;
  }

  cart.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    const quantity = item.quantity || 1;
    const itemTotal = item.price * quantity;
    
    itemElement.innerHTML = `
      <div class="item-details">
        <div class="item-name">${item.name}</div>
        <div class="item-unit">${item.unit}</div>
        <div class="item-price">$${item.price}</div>
      </div>
      <div class="item-quantity">
        <button onclick="updateQuantity(${index}, -1)" class="quantity-btn">
          <i class="fas fa-minus"></i>
        </button>
        <span>${quantity}</span>
        <button onclick="updateQuantity(${index}, 1)" class="quantity-btn">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div class="item-total">$${itemTotal}</div>
      <button onclick="removeFromCart(${index})" class="remove-button">
        <i class="fas fa-trash"></i>
      </button>
    `;
    cartContainer.appendChild(itemElement);
    total += itemTotal;
  });

  document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

// Initialize cart count when page loads
document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  displayCart();
});