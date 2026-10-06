const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const money = cents => currencyFormatter.format(cents / 100);

function imageFallback(event) {
  const image = event.target;
  if (image.src.endsWith('/images/product-placeholder.svg')) return;

  image.src = '/images/product-placeholder.svg';
}

export { money, imageFallback };
