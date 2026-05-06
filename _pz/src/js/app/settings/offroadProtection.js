app.settings.register('offroadProtection', {
  compute: (rawValue) => Boolean(rawValue),
  default: false,
  update: function () {},
})
