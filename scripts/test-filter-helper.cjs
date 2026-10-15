module.exports.selectFilter = async function selectFilter(page, label, values) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const options = page.getByRole('group', { name: 'Filtrar: ' + label, exact: true });
  await options.getByRole('checkbox').first().check();
  for (const value of values) await options.locator(`input[value="${value}"]`).check();
  await page.keyboard.press('Escape');
};
