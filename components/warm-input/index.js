Component({
  properties: {
    value: {
      type: String,
      value: '',
    },
    placeholder: {
      type: String,
      value: '',
    },
    maxlength: {
      type: Number,
      value: -1,
    },
    field: {
      type: String,
      value: '',
    },
    textarea: {
      type: Boolean,
      value: false,
    },
    customClass: {
      type: String,
      value: '',
    },
    minHeight: {
      type: String,
      value: '180rpx',
    },
  },
  methods: {
    handleInput(event) {
      this.triggerEvent('input', {
        value: event.detail.value,
        field: this.data.field,
      });
    },
  },
});