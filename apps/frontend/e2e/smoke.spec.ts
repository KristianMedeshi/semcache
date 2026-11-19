import { expect, test } from '@playwright/test';

test('renders workspace and navigates to sign in and sign up', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('SemCache Workspace')).toBeVisible();

  await page.getByRole('link', { name: 'Sign in' }).first().click();
  await expect(page.getByText('Welcome back')).toBeVisible();

  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page.getByText('Create your account')).toBeVisible();
});
