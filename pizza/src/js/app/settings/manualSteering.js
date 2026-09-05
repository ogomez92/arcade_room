// Off (default): assisted "rail" steering — Left/Right queue a turn for the
// next crossing. On: free continuous steering with solid curbs.
app.settings.register('manualSteering', {
  compute: (rawValue) => Boolean(rawValue),
  default: false,
  update: function () {},
})
