const btn = document.getElementById('test-btn');
const message = document.getElementById('message');

btn.addEventListener('click', () => {
    message.textContent = 'You clicked the button!';
});