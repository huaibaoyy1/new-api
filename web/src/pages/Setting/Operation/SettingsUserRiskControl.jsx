/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';
import { Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsUserRiskControl(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AutomaticDisableUserEnabled: false,
    AutomaticDisableUserErrorThreshold: 20,
    AutomaticDisableUserDurationMinutes: 60,
    AutomaticDisableUserLookbackMinutes: 60,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined)) {
            return showError(t('部分保存失败，请重试'));
          }
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('账户风控设置')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field={'AutomaticDisableUserEnabled'}
                label={t('错误过多时自动禁用账户')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={(value) =>
                  setInputs({
                    ...inputs,
                    AutomaticDisableUserEnabled: value,
                  })
                }
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                label={t('自动禁用账户错误次数阈值')}
                step={1}
                min={1}
                extraText={t('最近统计窗口内错误次数达到该值时自动禁用账户')}
                field={'AutomaticDisableUserErrorThreshold'}
                onChange={(value) =>
                  setInputs({
                    ...inputs,
                    AutomaticDisableUserErrorThreshold: parseInt(value),
                  })
                }
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                label={t('自动禁用账户时长')}
                step={1}
                min={1}
                suffix={t('分钟')}
                extraText={t('账户被自动禁用后持续多长时间自动解封')}
                field={'AutomaticDisableUserDurationMinutes'}
                onChange={(value) =>
                  setInputs({
                    ...inputs,
                    AutomaticDisableUserDurationMinutes: parseInt(value),
                  })
                }
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                label={t('自动禁用账户错误统计窗口')}
                step={1}
                min={1}
                suffix={t('分钟')}
                extraText={t('统计最近多少分钟内的错误次数')}
                field={'AutomaticDisableUserLookbackMinutes'}
                onChange={(value) =>
                  setInputs({
                    ...inputs,
                    AutomaticDisableUserLookbackMinutes: parseInt(value),
                  })
                }
              />
            </Col>
          </Row>
          <Row>
            <Button size='default' onClick={onSubmit}>
              {t('保存账户风控设置')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}