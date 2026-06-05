
(function () {
  const storageKeys = {
    subscribers: 'cupshadow_subscribers',
    messages: 'cupshadow_messages',
    bookings: 'cupshadow_bookings'
  };

  function loadList(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }
  function saveList(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function pushItem(key, item) {
    const list = loadList(key);
    list.unshift(item);
    saveList(key, list);
  }
  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function ensureToastContainer() {
    let el = document.getElementById('toastContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastContainer';
      el.className = 'toast-container toast-container-custom';
      document.body.appendChild(el);
    }
    return el;
  }
  function showToast(message, type = 'success') {
    const container = ensureToastContainer();
    const wrapper = document.createElement('div');
    const bg = type === 'danger' ? 'text-bg-danger' : 'text-bg-dark';
    wrapper.innerHTML = `
      <div class="toast ${bg} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>`;
    const toastEl = wrapper.firstElementChild;
    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 2600 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  }

  document.querySelectorAll('.copyright-year').forEach(el => el.textContent = new Date().getFullYear());

  // footer subscribe
  document.querySelectorAll('[data-subscribe-group]').forEach(group => {
    const input = group.querySelector('input[type="email"]');
    const button = group.querySelector('button');
    const submit = () => {
      const email = (input.value || '').trim();
      if (!validEmail(email)) {
        showToast('请输入有效的邮箱地址后再订阅。', 'danger');
        input.focus();
        return;
      }
      pushItem(storageKeys.subscribers, {
        email,
        page: document.body.dataset.page || document.title,
        time: new Date().toISOString()
      });
      input.value = '';
      showToast('订阅成功！我们会把最新咖啡资讯发送到您的邮箱。');
    };
    button && button.addEventListener('click', submit);
    input && input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  });

  // contact form
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = contactForm.querySelector('[name="name"]').value.trim();
      const email = contactForm.querySelector('[name="email"]').value.trim();
      const subject = contactForm.querySelector('[name="subject"]').value.trim();
      const message = contactForm.querySelector('[name="message"]').value.trim();
      if (!name || !validEmail(email) || !subject || !message) {
        showToast('请完整填写姓名、邮箱、主题和留言内容。', 'danger');
        return;
      }
      pushItem(storageKeys.messages, { name, email, subject, message, time: new Date().toISOString() });
      contactForm.reset();
      showToast('留言发送成功！我们会尽快与您联系。');
    });
  }

  // booking modal
  const bookingModalEl = document.getElementById('bookingModal');
  if (bookingModalEl) {
    const bookingModal = new bootstrap.Modal(bookingModalEl);
    const bookingForm = document.getElementById('bookingForm');
    const bookingTitle = document.getElementById('bookingModalLabel');
    const bookingType = document.getElementById('bookingType');
    const bookingCourse = document.getElementById('bookingCourse');

    document.querySelectorAll('[data-booking-trigger]').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const title = this.dataset.modalTitle || '预约信息';
        bookingTitle.textContent = title;
        bookingType.value = this.dataset.bookingType || this.textContent.trim();
        bookingCourse.value = this.dataset.course || this.textContent.trim();
        bookingModal.show();
      });
    });

    bookingForm && bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(bookingForm).entries());
      if (!formData.name || !validEmail(formData.email) || !formData.phone || !formData.course) {
        showToast('请完整填写预约信息。', 'danger');
        return;
      }
      formData.time = new Date().toISOString();
      pushItem(storageKeys.bookings, formData);
      bookingForm.reset();
      bookingModal.hide();
      showToast('预约提交成功！我们会尽快与您确认课程安排。');
    });
  }

  // brewing calculator
  const calculatorForm = document.getElementById('brewCalculatorForm');
  if (calculatorForm) {
    const coffeeInput = document.getElementById('coffeeAmount');
    const ratioInput = document.getElementById('waterRatio');
    const waterOutput = document.getElementById('waterAmountResult');
    const hintOutput = document.getElementById('brewHintResult');
    const methodSelect = document.getElementById('brewMethodSelect');
    const hints = {
      '手冲咖啡': '建议分段注水，闷蒸约 30 秒，总时长约 2 分 30 秒。',
      '法压壶': '建议粗研磨，浸泡约 4 分钟后缓慢下压滤网。',
      '意式浓缩': '建议细研磨，小粉量高压快速萃取，单杯约 25–30 秒。',
      '摩卡壶': '建议中细研磨，小火加热，听到萃取声后及时离火。'
    };
    function updateCalc() {
      const coffee = Number(coffeeInput.value || 0);
      const ratio = Number(ratioInput.value || 0);
      const water = coffee * ratio;
      waterOutput.textContent = `${water.toFixed(0)} ml`;
      hintOutput.textContent = hints[methodSelect.value] || '建议根据器具与咖啡豆风味微调参数。';
    }
    calculatorForm.addEventListener('submit', function (e) { e.preventDefault(); updateCalc(); showToast('冲泡参数已计算完成。'); });
    [coffeeInput, ratioInput, methodSelect].forEach(el => el && el.addEventListener('input', updateCalc));
    updateCalc();
  }

  // back to top
  const topBtn = document.getElementById('backToTop');
  if (topBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 320) topBtn.classList.add('show');
      else topBtn.classList.remove('show');
    });
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
})();
