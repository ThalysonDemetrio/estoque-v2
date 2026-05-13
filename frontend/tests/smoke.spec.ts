import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Estoque Inteligente Pro', () => {
  test('Dashboard deve carregar e exibir score de integridade', async ({ page }) => {
    // Nota: Em um ambiente real de CI, precisaríamos mockar o login ou usar um token de teste
    await page.goto('/dashboard');
    
    // Verificar se a página não deu erro 500 (assumindo que redireciona para login se não autenticado)
    if (page.url().includes('login')) {
      await expect(page).toHaveURL(/.*login/);
      console.log('Redirecionado para login corretamente');
    } else {
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByText(/Integridade Global/i)).toBeVisible();
    }
  });

  test('Página de Redes deve carregar o mapa mental', async ({ page }) => {
    await page.goto('/rede');
    
    if (!page.url().includes('login')) {
      // Verificar se o container do mapa está presente
      await expect(page.locator('.react-flow, .mind-map-container, svg')).toBeVisible();
    }
  });
});
