import { CreateQueueCommand, SQSClient } from '@aws-sdk/client-sqs';

const queueName = process.env.LOCALSTACK_QUEUE_NAME ?? 'fbrissi-contact-form';

export const sqs = new SQSClient({
  endpoint: process.env.LOCALSTACK_ENDPOINT ?? 'http://localstack:4566',
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

let queueUrl: string | undefined;

export async function getContactQueueUrl(): Promise<string> {
  if (queueUrl) return queueUrl;

  const result = await sqs.send(new CreateQueueCommand({ QueueName: queueName }));
  if (!result.QueueUrl) throw new Error('LocalStack did not return a queue URL');

  queueUrl = result.QueueUrl;
  return queueUrl;
}
