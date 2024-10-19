import path from "node:path";
import { ArnFormat, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { Architecture, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

export class CdkStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const chromium = LayerVersion.fromLayerVersionArn(
			this,
			"chromium-layer",
			this.formatArn({
				service: "lambda",
				resource: "layer",
				resourceName: "chromium:4",
				arnFormat: ArnFormat.COLON_RESOURCE_NAME,
			}),
		);

		const visaScrapper = new NodejsFunction(this, "visa-scrapper", {
			functionName: "visa-scrapper",
			entry: path.join(__dirname, "./lambdas/visa-scrapper.ts"),
			bundling: {
				minify: true,
				sourceMap: true,
				externalModules: ["@aws-sdk/*", "@sparticuz/chromium"],
			},
			architecture: Architecture.X86_64,
			runtime: Runtime.NODEJS_20_X,
			layers: [chromium],
			logRetention: RetentionDays.ONE_DAY,
			timeout: Duration.seconds(120),
			memorySize: 1024,
			environment: {
				VISA_SIGN_IN_URL: process.env.VISA_SIGN_IN_URL ?? "",
				VISA_RE_SCHEDULE_URL: process.env.VISA_RE_SCHEDULE_URL ?? "",
				VISA_USER_EMAIL: process.env.VISA_USER_EMAIL ?? "",
				VISA_USER_PASSWORD: process.env.VISA_USER_PASSWORD ?? "",
			},
		});

		console.info(visaScrapper.node.id);

		// new Rule(this, "visa-scrapper-rule", {
		//   ruleName: "visa-scrapper-rule",
		//   description: "Schedule visa scrapper lambda to run every 1 hour",
		//   schedule: Schedule.rate(Duration.hours(1)),
		//   targets: [
		//     new LambdaFunction(visaScrapper, {
		//       retryAttempts: 1,
		//     }),
		//   ],
		// });
	}
}
