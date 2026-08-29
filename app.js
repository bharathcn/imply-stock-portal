const products = [
  { brand:'IMPLY', family:'Royal', thickness:'18 mm', size:'8 × 4 ft', grade:'BWP', tally:'IMPLY ROYAL 18MM 8X4 BWP', qty:42, price:2850, godown:'RR Nagar: 30 · Main: 12' },
  { brand:'IMPLY', family:'Royal', thickness:'12 mm', size:'8 × 4 ft', grade:'BWP', tally:'IMPLY ROYAL 12MM 8X4 BWP', qty:0, price:2380, godown:'RR Nagar: 0 · Main: 0' },
  { brand:'IMPLY', family:'Plus', thickness:'18 mm', size:'8 × 4 ft', grade:'BWR', tally:'IMPLY PLUS 18MM 8X4 BWR', qty:8, price:2490, godown:'RR Nagar: 5 · Main: 3' },
  { brand:'IMPLY', family:'OG', thickness:'16 mm', size:'8 × 4 ft', grade:'BWP', tally:'IMPLY OG 16MM 8X4 BWP', qty:21, price:2680, godown:'RR Nagar: 15 · Main: 6' },
  { brand:'IMPLY', family:'Calibrated', thickness:'18 mm', size:'8 × 4 ft', grade:'BWR', tally:'IMPLY CALIBRATED 18MM 8X4 BWR', qty:0, price:3120, godown:'RR Nagar: 0 · Main: 0' },
  { brand:'IMPLY', family:'Bliss', thickness:'12 mm', size:'7 × 4 ft', grade:'MR', tally:'IMPLY BLISS 12MM 7X4 MR', qty:57, price:1790, godown:'RR Nagar: 37 · Main: 20' }
];

const order = ['brand','family','thickness','size','grade'];
const fields = Object.fromEntries(order.map(k => [k, document.getElementById(k)]));

function matching(beforeKey){
  const stop = order.indexOf(beforeKey);
  return products.filter(p => order.slice(0, stop).every(k => !fields[k].value || p[k] === fields[k].value));
}

function refreshFrom(startIndex = 0){
  order.slice(startIndex).forEach((key, offset) => {
    const select = fields[key];
    const previous = select.value;
    const options = [...new Set(matching(key).map(p => p[key]))];
    select.innerHTML = options.map(v => `<option value="${v}">${v}</option>`).join('');
    if(options.includes(previous)) select.value = previous;
  });
}

order.forEach((key, index) => fields[key].addEventListener('change', () => {
  refreshFrom(index + 1);
  document.getElementById('result').hidden = true;
}));

document.getElementById('lookupForm').addEventListener('submit', event => {
  event.preventDefault();
  const product = products.find(p => order.every(k => p[k] === fields[k].value));
  if(!product) return;
  document.getElementById('productTitle').textContent = `${product.brand} ${product.family} · ${product.thickness} · ${product.size} · ${product.grade}`;
  document.getElementById('tallyName').textContent = `Mapped item: ${product.tally}`;
  document.getElementById('quantity').textContent = `${product.qty} sheets`;
  document.getElementById('price').textContent = `₹${product.price.toLocaleString('en-IN')}`;
  document.getElementById('godown').textContent = product.godown;
  const badge = document.getElementById('availabilityBadge');
  badge.className = `badge ${product.qty === 0 ? 'out' : product.qty <= 10 ? 'low' : 'in'}`;
  badge.textContent = product.qty === 0 ? 'Out of stock' : product.qty <= 10 ? 'Low stock' : 'In stock';
  document.getElementById('result').hidden = false;
  document.getElementById('result').scrollIntoView({behavior:'smooth',block:'nearest'});
});

refreshFrom();
