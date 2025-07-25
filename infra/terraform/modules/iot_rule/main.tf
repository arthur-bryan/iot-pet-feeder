resource "aws_iot_topic_rule" "this" {
  name        = var.rule_name
  description = var.rule_description
  enabled     = true
  sql         = "SELECT * FROM '${var.mqtt_topic}'"
  sql_version = "2016-03-23"

  lambda {
    function_arn = var.lambda_function_arn
  }

  error_action {
    cloudwatch_alarm {
      role_arn    = var.lambda_execution_role_arn
      alarm_name  = "${var.project_name}-IoT-Rule-Error-${var.rule_name}"
      state_reason = "IoT Rule failed to execute action."
      state_value = "ALARM"
    }
  }

  tags = {
    Project = var.project_name
  }
}

resource "aws_lambda_permission" "iot_rule_lambda_permission" {
  statement_id  = "AllowIoTRuleInvokeLambda-${var.rule_name}"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name_for_permission
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_topic_rule.this.arn
}