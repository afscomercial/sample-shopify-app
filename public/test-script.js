const header = $('header.site-header').parent();

header
  .prepend('<div>Hello this is coming from the public folder</div>')
  .css({ 'background-color': 'orange', 'text-align': 'center' });
