import Chromium from "@sparticuz/chromium";
import type { Handler } from "aws-lambda";
import type { Page } from "puppeteer-core";
import puppeteer from "puppeteer-core";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const visaSignInUrl = process.env.VISA_SIGN_IN_URL;
const visaRescheduleUrl = process.env.VISA_RE_SCHEDULE_URL;
const visaUserEmail = process.env.VISA_USER_EMAIL;
const visaUserPassword = process.env.VISA_USER_PASSWORD;

const visaScrapper = async (page: Page) => {
	if (
		!visaSignInUrl ||
		!visaRescheduleUrl ||
		!visaUserEmail ||
		!visaUserPassword
	) {
		throw new Error("Missing required environment variables.");
	}

	// Navigate the page to a URL
	await page.goto(visaSignInUrl);

	// login page
	const emailSelector = "#user_email";
	const passwordSelector = "#user_password";
	const termsSelector = 'label[for="policy_confirmed"]';
	const loginSelector = 'input[type="submit"]';

	await page.waitForSelector(emailSelector);
	await page.waitForSelector(passwordSelector);
	await page.waitForSelector(termsSelector);
	await page.waitForSelector(loginSelector);

	await page.type(emailSelector, visaUserEmail);
	await wait(500);
	await page.type(passwordSelector, visaUserPassword);
	await wait(500);
	await page.click(termsSelector);
	await wait(500);
	await page.click(loginSelector);
	await page.waitForNavigation();
	await wait(5_000);

	// user page
	const firstContinueSelector = "a.button.primary.small";

	await page.waitForSelector(firstContinueSelector);
	const href = await page.$eval(
		firstContinueSelector,
		(link) => link.getAttribute("href") ?? "",
	);
	const [_, scheduleId] = RegExp(/schedule\/(\d+)\//).exec(href) ?? [];
	await page.goto(visaRescheduleUrl.replace("schedule_id", scheduleId));
	await wait(10_000);

	// reschedule page
	const inputDatePickerSelector = "#appointments_consulate_appointment_date";

	await page.waitForSelector(inputDatePickerSelector);
	await page.click(inputDatePickerSelector);

	let count = 0;
	let availabilities: string[] = [];
	const datePickerNextSelector =
		'a.ui-datepicker-next.ui-corner-all[data-handler="next"]';
	const availableDaysSelector = "td[data-handler=selectDay]";

	do {
		await page.waitForSelector(datePickerNextSelector);

		const result = await page.$$eval(availableDaysSelector, (tds) => {
			return tds.map((td) => {
				const year = Number(td.getAttribute("data-year"));
				const month = Number(td.getAttribute("data-month"));
				const day = Number(td.textContent);
				const date = new Date(year, month, day);

				return date.toISOString().split("T")[0];
			});
		});

		if (result.length) {
			availabilities = [...new Set(availabilities.concat(result))];
			count++;
		}

		await page.click(datePickerNextSelector);
		await wait(500);
	} while (count < 2);

	return availabilities;
};

export const handler: Handler = async () => {
	const browser = await puppeteer.launch({
		args: Chromium.args,
		defaultViewport: Chromium.defaultViewport,
		executablePath: await Chromium.executablePath(),
		headless: Chromium.headless,
		ignoreHTTPSErrors: true,
	});
	const page = await browser.newPage();
	const results = await visaScrapper(page);
	await browser.close();

	console.info({ results });
};
