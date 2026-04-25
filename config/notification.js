const momentNotificationConfig = {
  templateId: 'nbLUfsYmUpgp6wAilayryenmx89w_fXZP5BcmSjPBjg',
  page: 'pages/home/index',
  fields: {
    time: 'time4',
    content: 'thing3',
    sender: 'thing2',
  },
};

export function getMomentNotificationConfig() {
  return {
    ...momentNotificationConfig,
    fields: {
      ...momentNotificationConfig.fields,
    },
  };
}

export default momentNotificationConfig;
