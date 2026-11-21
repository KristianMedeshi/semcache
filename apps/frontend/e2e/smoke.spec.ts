import { expect, test } from '@playwright/test';

test('renders telecom support portal and navigates to sign in, forgot password, and sign up', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Instant support for your mobile services')).toBeVisible();

  await page
    .getByRole('link', { name: /sign in/i })
    .first()
    .click();
  await expect(page.getByText('Welcome back')).toBeVisible();

  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByText('Reset your password')).toBeVisible();

  await page.getByRole('link', { name: /back to sign in/i }).click();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page.getByText('Create your account')).toBeVisible();
});
