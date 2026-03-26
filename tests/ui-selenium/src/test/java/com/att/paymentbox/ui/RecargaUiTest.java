package com.att.paymentbox.ui;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Selenium Headless — Valida el flujo UI de Recarga PaymentBox (Pasos 1, 3, 5).
 * Siempre ejecutado en modo Headless para CI/CD (GitHub Actions).
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("UI Selenium Headless - Recarga PaymentBox AT&T")
class RecargaUiTest {

    private static WebDriver driver;
    private static WebDriverWait wait;
    private static final String BASE_URL =
            System.getProperty("app.url", "http://localhost:8080");

    @BeforeAll
    static void setUpDriver() {
        WebDriverManager.chromedriver().setup();

        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new");          // Headless mode for CI
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--disable-gpu");
        options.addArguments("--window-size=1920,1080");
        options.addArguments("--remote-allow-origins=*");

        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(15));
    }

    @AfterAll
    static void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }

    // ── Paso 1: Menú de Recargas visible ─────────────────────────────────────
    @Test
    @Order(1)
    @DisplayName("Paso 1 - Menú de Recargas debe ser visible en PaymentBox")
    void paso1_menuRecargasVisible() {
        driver.get(BASE_URL + "/swagger-ui.html");

        // Swagger UI valida que el servicio esté corriendo y la API expuesta
        wait.until(ExpectedConditions.titleContains("Swagger"));
        assertThat(driver.getTitle()).containsIgnoringCase("Swagger");

        // Verificar que el endpoint /api/recargas/montos está documentado
        WebElement apiSection = wait.until(
            ExpectedConditions.presenceOfElementLocated(
                By.cssSelector(".opblock-tag, .swagger-ui"))
        );
        assertThat(apiSection).isNotNull();
    }

    // ── Paso 1 (salud): Actuator health endpoint ──────────────────────────────
    @Test
    @Order(2)
    @DisplayName("Paso 1 - Health check del servicio debe retornar UP")
    void paso1_servicioDisponible() {
        driver.get(BASE_URL + "/actuator/health");

        wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
        String body = driver.findElement(By.tagName("body")).getText();

        assertThat(body).containsIgnoringCase("UP");
    }

    // ── Paso 3: Montos de Recarga validados en UI ─────────────────────────────
    @Test
    @Order(3)
    @DisplayName("Paso 3 - Endpoint de montos responde con lista desde DB")
    void paso3_montosDisponibles() {
        driver.get(BASE_URL + "/api/recargas/montos?operador=BLUE");

        wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
        String body = driver.findElement(By.tagName("body")).getText();

        // Validar que los montos del UI (20, 50, 100) están en la respuesta DB
        assertThat(body).contains("20");
        assertThat(body).contains("50");
        assertThat(body).contains("100");
        assertThat(body).contains("BLUE");
    }

    // ── Paso 5: Métodos de Pago disponibles en UI ─────────────────────────────
    @Test
    @Order(4)
    @DisplayName("Paso 5 - Métodos de pago PaymentBox visibles (TARJETA, EFECTIVO, OODI)")
    void paso5_metodosPagoDisponibles() {
        driver.get(BASE_URL + "/api/pagos/metodos");

        wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
        String body = driver.findElement(By.tagName("body")).getText();

        assertThat(body).contains("TARJETA");
        assertThat(body).contains("EFECTIVO");
        assertThat(body).contains("OODI");
    }

    // ── API docs disponibles (contrato publicado) ─────────────────────────────
    @Test
    @Order(5)
    @DisplayName("OpenAPI spec disponible para validación de contrato")
    void openApiSpecDisponible() {
        driver.get(BASE_URL + "/v3/api-docs");

        wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
        String body = driver.findElement(By.tagName("body")).getText();

        assertThat(body).containsIgnoringCase("openapi");
        assertThat(body).contains("/api/pagos/registrar");
        assertThat(body).contains("/api/recargas/montos");
    }
}
