Component({
  properties: {
    theme: {
      type: String,
      value: 'primary',
    },
    variant: {
      type: String,
      value: 'base',
    },
    size: {
      type: String,
      value: 'large',
    },
    block: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    shape: {
      type: String,
      value: '',
    },
  },
  data: {
    rootClass: 'warm-button warm-button--primary',
    styleVars: '',
  },
  observers: {
    'theme,variant,disabled': function (theme, variant, disabled) {
      let rootClass = 'warm-button warm-button--primary';
      let styleVars = [
        '--td-button-border-width: 0rpx',
        '--td-button-border-radius: 48rpx',
        '--td-button-large-height: 96rpx',
        '--td-button-large-font-size: 28rpx',
        '--td-button-large-padding-horizontal: 38rpx',
        '--td-button-font-weight: 700',
      ];

      if (theme === 'light') {
        rootClass = 'warm-button warm-button--light';
        styleVars = styleVars.concat([
          '--td-button-light-color: #B86E79',
          '--td-button-light-bg-color: rgba(255, 182, 193, 0.18)',
          '--td-button-light-border-color: rgba(255, 182, 193, 0)',
          '--td-button-light-active-bg-color: rgba(255, 182, 193, 0.28)',
          '--td-button-light-active-border-color: rgba(255, 182, 193, 0)',
          '--td-button-light-disabled-color: #D8A1AA',
          '--td-button-light-disabled-bg: rgba(255, 182, 193, 0.12)',
          '--td-button-light-disabled-border-color: rgba(255, 182, 193, 0)',
        ]);
      } else if (theme === 'danger' && variant === 'outline') {
        rootClass = 'warm-button warm-button--danger-outline';
        styleVars = styleVars.concat([
          '--td-button-danger-outline-color: #D56B78',
          '--td-button-danger-outline-border-color: rgba(240, 148, 159, 0.3)',
          '--td-button-danger-outline-active-bg-color: rgba(255, 240, 243, 1)',
          '--td-button-danger-outline-active-border-color: rgba(240, 148, 159, 0.42)',
          '--td-button-danger-outline-disabled-color: #E1A6AE',
        ]);
      } else if (theme === 'danger') {
        rootClass = 'warm-button warm-button--danger';
        styleVars = styleVars.concat([
          '--td-button-danger-color: #FFFFFF',
          '--td-button-danger-bg-color: #F2949F',
          '--td-button-danger-border-color: rgba(242, 148, 159, 0)',
          '--td-button-danger-active-bg-color: #E87886',
          '--td-button-danger-active-border-color: rgba(232, 120, 134, 0)',
          '--td-button-danger-disabled-color: rgba(255, 255, 255, 0.92)',
          '--td-button-danger-disabled-bg: #F5B6BE',
          '--td-button-danger-disabled-border-color: rgba(245, 182, 190, 0)',
        ]);
      }
      else {
        styleVars = styleVars.concat([
          '--td-button-primary-color: #FFFFFF',
          '--td-button-primary-bg-color: #FF9EAA',
          '--td-button-primary-border-color: rgba(255, 158, 170, 0)',
          '--td-button-primary-active-bg-color: #F58C9A',
          '--td-button-primary-active-border-color: rgba(245, 140, 154, 0)',
          '--td-button-primary-disabled-color: rgba(255, 255, 255, 0.92)',
          '--td-button-primary-disabled-bg: #F3C1C7',
          '--td-button-primary-disabled-border-color: rgba(243, 193, 199, 0)',
        ]);
      }

      if (disabled) {
        styleVars.push('--td-button-border-width: 0rpx');
      }

      this.setData({
        rootClass,
        styleVars: styleVars.join('; '),
      });
    },
  },
  methods: {
    handleTap(event) {
      if (this.data.loading || this.data.disabled) return;
      this.triggerEvent('action', event.detail);
    },
  },
});