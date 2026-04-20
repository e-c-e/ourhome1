Component({
  properties: {
    title: {
      type: String,
      value: '',
    },
    leftArrow: {
      type: Boolean,
      value: false,
    },
  },
  methods: {
    handleBackTap() {
      this.triggerEvent('left-click');
    },
    handleLeftClick(event) {
      this.triggerEvent('left-click', event.detail);
    },
  },
});