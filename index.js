import puppeteer from "puppeteer-extra";
import dotenv from "dotenv";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import XLSX from "xlsx";
import { Locator } from "puppeteer";


(async () => {
  try {
    // Load environment variables from .env file
    dotenv.config();
    // Use StealthPlugin for stealth browsing
    puppeteer.use(StealthPlugin());
    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: false, 
      args: [
        "--incognito", // Open browser in incognito mode
      ],
      slowMo: 50, // Slow down Puppeteer operations by 50 milliseconds
    });

    // Credentials and filters
    const USERNAME = process.env.USER_NAME;
    const PASSWORD = process.env.PASSWORD;
    const SEARCH_FIELD = "education";
    const LOCATION_FILTER = ["India", "dubai"];
    const INDUSTRY_FILTER = ["Education"];
    const TOTAL_COMPANY = 50;

    // Open a new page
    const page = await browser.newPage();

    // Set viewport size
    await page.setViewport({ width: 1200, height: 2000 });

    // Navigate to LinkedIn homepage
    await page.goto("https://www.linkedin.com/home");

    // Fill in username and password fields
    await page.waitForSelector("#session_key");
    await page.type("#session_key", USERNAME, { delay: 100 });
    await page.waitForSelector("#session_password"); // Wait for 5 second
    await new Promise((r) => setTimeout(r, 5000));
    await page.type("#session_password", PASSWORD, { delay: 100 });
    await new Promise((r) => setTimeout(r, 5000)); // Wait for 5 second

    // Press Enter to log in
    await page.keyboard.press("Enter");
    await page.waitForNavigation(); // Wait for navigation to complete

    // Search for companies
    await page.locator(".search-global-typeahead__input").fill(SEARCH_FIELD);
    await new Promise((r) => setTimeout(r, 5000));
    await page.keyboard.press("Enter");
    await page.waitForNavigation();

    // Click on "Companies" button in filters
    await page.waitForSelector("#search-reusables__filters-bar");
    let buttonBar = await page.$("#search-reusables__filters-bar");
    let buttons = await buttonBar.$$("button");
    for (const button of buttons) {
      let innerText = await page.evaluate(
        (val) => val.textContent.trim(),
        button
      );
      if (innerText === "Companies") {
        await button.click();
        break;
      }
    }

    // Function to filter by location and industry
    async function filter(filterInput, filterText, ResultBtn) {
      for (let text of filterText) {
        await filterInput.type(text);
        const dropdownId = await page.evaluate((input) => {
          return input.getAttribute("aria-controls");
        }, filterInput);
        await page.waitForSelector(`#${dropdownId}`);
        const dropdown = await page.$(`#${dropdownId}`);
        const html = await dropdown.evaluate((drop) => drop.innerHTML);
        await dropdown.waitForSelector("span span");
        const dropdownContent = await dropdown.$$("span span");
        let i;
        let textContainField;
        for (i = 0; i < dropdownContent.length; i++) {
          const item = dropdownContent[i];
          const textContent = await item.evaluate((item) => item.innerText);
          if (textContent.toLowerCase() === text.toLowerCase()) {
            await item.click();
            break;
          } else if (textContent.toLowerCase().includes(text.toLowerCase())) {
            textContainField = item;
          }
        }
        if (i === dropdownContent.length) await textContainField.click();
        await filterInput.evaluate((input) => (input.value = ""));
        await new Promise((r) => setTimeout(r, 2000));
      }
      await ResultBtn.click();
    }

    // Filter by location
    await page.waitForSelector("#searchFilter_companyHqGeo");
    const location = await page.$("#searchFilter_companyHqGeo");
    await location.click();
    await page.waitForSelector(
      '.reusable-search-filters-trigger-dropdown__container input[placeholder="Add a location"]'
    );
    const locationInput = await page.$(
      '.reusable-search-filters-trigger-dropdown__container input[placeholder="Add a location"]'
    );
    const locationResultBtn = await page.$$(
      'button[data-control-name="filter_show_results"]'
    );
    await filter(locationInput, LOCATION_FILTER, locationResultBtn[0]);

    // Filter by industry
    await page.waitForSelector("#searchFilter_industryCompanyVertical");
    const industry = await page.$("#searchFilter_industryCompanyVertical");
    await industry.click();
    await page.waitForSelector(
      '.reusable-search-filters-trigger-dropdown__container input[placeholder="Add an industry"]'
    );
    const industriesInput = await page.$(
      '.reusable-search-filters-trigger-dropdown__container input[placeholder="Add an industry"]'
    );
    const industryResultBtn = await page.$$(
      'button[data-control-name="filter_show_results"]'
    );
    await filter(industriesInput, INDUSTRY_FILTER, industryResultBtn[1]);

    // Filter by company size
    await page.waitForSelector("#searchFilter_companySize");
    const company = await page.$("#searchFilter_companySize");
    await company.click();
    await page.waitForSelector("#companySize-C");
    const companySize = await page.$("#companySize-C");
    await companySize.click();
    const companyResultBtn = await page.$$(
      'button[data-control-name="filter_show_results"]'
    );
    await companyResultBtn[2].click();

    // Function to fetch company data
    const Data = [];
    async function filterCompanyData() {
      await page.waitForSelector(
        ".search-results-container .app-aware-link:not(.reusable-search-simple-insight__wrapping-link,.scale-down)"
      );
      const companyLinkElements = await page.$$(
        ".search-results-container .app-aware-link:not(.reusable-search-simple-insight__wrapping-link,.scale-down)"
      );
      let companyLinks = [];
      for (let companylink of companyLinkElements) {
        const link = await companylink.evaluate(
          (link) => `${link.getAttribute("href")}about`
        );
        companyLinks.push(link);
      }
      for (let companylink of companyLinks) {
        const companyPage = await browser.newPage();
        await companyPage.goto(companylink);
        await companyPage.waitForSelector("h1");
        const companyName = await companyPage.$("h1");
        const companyNameValue = await companyName.evaluate((name)=>name.innerText);
        await companyPage.waitForSelector("dl dt");
        const heading = await companyPage.$$("dl dt");
        let companyData = {};
        companyData.Name = companyNameValue;
        for (const content of heading) {
          const key = await content.evaluate((content) => content.innerText);
          let value;
          if (key == "Website" || key == "Phone") {
            value = await content.evaluate(
              (content) =>
                content.nextElementSibling.querySelector("span").innerText
            );
          } else {
            value = await content.evaluate(
              (content) => content.nextElementSibling.innerText
            );
          }
          companyData = { ...companyData, [key]: value };
        }
        Data.push(companyData);
        await companyPage.close();
        if (Data.length >= TOTAL_COMPANY) return;
      }
        await page.waitForSelector('button[aria-label="Next"]');
        const nextBtn = await page.$('button[aria-label="Next"]');
        await nextBtn.click();
        await new Promise((r) => setTimeout(r, 5000));
        await filterCompanyData();
    }

    await filterCompanyData();
    console.log(Data);
    await page.close();
    
    const dataArray = [];
   // Extract headers from the first object
const headers = Object.keys(Data[0]);

// Extract data rows
const dataRows = Data.map(obj => headers.map(header => obj[header] || ""));

// Insert headers as the first row
dataRows.unshift(headers);

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Convert data rows to worksheet
const worksheet = XLSX.utils.aoa_to_sheet(dataRows);

// Append worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
XLSX.writeFile(workbook, 'companyData.xlsx');  // Write the workbook to a file
  } catch (error) {
    console.log(error.message);
  }
})();
