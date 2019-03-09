interface Test {
    Type: string
    Value: string
}

interface TestBinary {
    Type: string
    Value: string
}

interface MessageAttributes {
    Test: Test
    TestBinary: TestBinary
}

export interface Sns {
    MessageId: string
    Signature: string
    Type: string
    TopicArn: string
    MessageAttributes: MessageAttributes
    SignatureVersion: string
    Timestamp: Date
    SigningCertUrl: string
    Message: any
    UnsubscribeUrl: string
    Subject: string
}

export interface Record {
    EventVersion: string
    EventSource: string
    EventSubscriptionArn: string
    Sns: Sns
}

export interface AmazonSNSEvent {
    Records: Record[]
}
